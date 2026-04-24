/**
 * Digital Signature Service
 * Handles digital signature requests, verification, and audit trail for contracts
 */

import crypto from 'crypto';
import { db } from '../database/connection';
import { sendgridClient } from '../services/sendgrid/client';
import { config } from '../config';
import logger from '../utils/logger';

export enum SignatureStatus {
  PENDING = 'PENDING',
  SIGNED = 'SIGNED',
  DECLINED = 'DECLINED',
  EXPIRED = 'EXPIRED',
}

export interface SignatureRequest {
  id: string;
  contractId: string;
  signerEmail: string;
  signerName: string;
  token: string;
  status: SignatureStatus;
  signedAt?: Date;
  declinedAt?: Date;
  declineReason?: string;
  ipAddress?: string;
  userAgent?: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface SignatureResult {
  signatureRequestId: string;
  contractId: string;
  signerEmail: string;
  signedAt: Date;
  ipAddress: string;
  signatureHash: string;
}

export class SignatureService {
  /**
   * Create a signature request and send signing link to signer
   */
  async createSignatureRequest(
    contractId: string,
    signerEmail: string,
    signerName: string,
    requestedBy: string
  ): Promise<SignatureRequest> {
    try {
      // Verify contract exists
      const contractResult = await db.query(
        'SELECT id, reference_number FROM contracts WHERE id = $1',
        [contractId]
      );
      if (contractResult.rows.length === 0) throw new Error('Contract not found');

      const contract = contractResult.rows[0];

      // Generate secure token (valid 7 days)
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const result = await db.query(
        `INSERT INTO signature_requests
           (contract_id, signer_email, signer_name, token, status, expires_at, requested_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, contract_id, signer_email, signer_name, token, status,
                   expires_at, created_at`,
        [contractId, signerEmail, signerName, token, SignatureStatus.PENDING, expiresAt, requestedBy]
      );

      const req = result.rows[0];

      // Send signing link via email
      const signingLink = `${config.apiBaseUrl}/contracts/sign?token=${token}`;
      await sendgridClient.sendEmail({
        to: signerEmail,
        subject: `Signature Required: Contract ${contract.reference_number}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Digital Signature Required</h2>
            <p>Dear ${signerName},</p>
            <p>You have been requested to sign contract <strong>${contract.reference_number}</strong>.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${signingLink}"
                 style="background-color: #4CAF50; color: white; padding: 14px 28px; text-decoration: none; border-radius: 4px; display: inline-block;">
                Review & Sign Contract
              </a>
            </div>
            <p>This link expires on ${expiresAt.toLocaleDateString()}.</p>
            <p style="color: #666; font-size: 12px;">TechSwiftTrix ERP System</p>
          </div>
        `,
      });

      logger.info('Signature request created', {
        signatureRequestId: req.id,
        contractId,
        signerEmail,
      });

      return {
        id: req.id,
        contractId: req.contract_id,
        signerEmail: req.signer_email,
        signerName: req.signer_name,
        token: req.token,
        status: req.status,
        expiresAt: req.expires_at,
        createdAt: req.created_at,
      };
    } catch (error) {
      logger.error('Failed to create signature request', { error, contractId, signerEmail });
      throw error;
    }
  }

  /**
   * Process a signature submission
   */
  async signContract(
    token: string,
    ipAddress: string,
    userAgent: string
  ): Promise<SignatureResult> {
    try {
      const reqResult = await db.query(
        `SELECT id, contract_id, signer_email, signer_name, status, expires_at
         FROM signature_requests WHERE token = $1`,
        [token]
      );

      if (reqResult.rows.length === 0) throw new Error('Invalid signature token');

      const sigReq = reqResult.rows[0];

      if (sigReq.status !== SignatureStatus.PENDING) {
        throw new Error(`Signature request is already ${sigReq.status}`);
      }

      if (new Date(sigReq.expires_at) < new Date()) {
        await db.query(
          `UPDATE signature_requests SET status = $1 WHERE id = $2`,
          [SignatureStatus.EXPIRED, sigReq.id]
        );
        throw new Error('Signature link has expired');
      }

      const signedAt = new Date();
      // Create a tamper-evident hash of the signature event
      const signatureHash = crypto
        .createHash('sha256')
        .update(`${sigReq.contract_id}:${sigReq.signer_email}:${signedAt.toISOString()}:${ipAddress}`)
        .digest('hex');

      await db.query(
        `UPDATE signature_requests
         SET status = $1, signed_at = $2, ip_address = $3, user_agent = $4, signature_hash = $5
         WHERE id = $6`,
        [SignatureStatus.SIGNED, signedAt, ipAddress, userAgent, signatureHash, sigReq.id]
      );

      // Mark contract as signed
      await db.query(
        `UPDATE contracts SET signed_at = $1, signed_by_email = $2 WHERE id = $3`,
        [signedAt, sigReq.signer_email, sigReq.contract_id]
      );

      logger.info('Contract signed successfully', {
        contractId: sigReq.contract_id,
        signerEmail: sigReq.signer_email,
        signatureHash,
      });

      return {
        signatureRequestId: sigReq.id,
        contractId: sigReq.contract_id,
        signerEmail: sigReq.signer_email,
        signedAt,
        ipAddress,
        signatureHash,
      };
    } catch (error) {
      logger.error('Failed to sign contract', { error, token });
      throw error;
    }
  }

  /**
   * Decline a signature request
   */
  async declineSignature(token: string, reason: string): Promise<void> {
    try {
      const reqResult = await db.query(
        `SELECT id, status, expires_at FROM signature_requests WHERE token = $1`,
        [token]
      );

      if (reqResult.rows.length === 0) throw new Error('Invalid signature token');
      const sigReq = reqResult.rows[0];

      if (sigReq.status !== SignatureStatus.PENDING) {
        throw new Error(`Signature request is already ${sigReq.status}`);
      }

      await db.query(
        `UPDATE signature_requests SET status = $1, declined_at = NOW(), decline_reason = $2 WHERE id = $3`,
        [SignatureStatus.DECLINED, reason, sigReq.id]
      );

      logger.info('Signature declined', { signatureRequestId: sigReq.id, reason });
    } catch (error) {
      logger.error('Failed to decline signature', { error, token });
      throw error;
    }
  }

  /**
   * Get all signature requests for a contract
   */
  async getSignatureRequests(contractId: string): Promise<SignatureRequest[]> {
    const result = await db.query(
      `SELECT id, contract_id, signer_email, signer_name, status,
              signed_at, declined_at, decline_reason, ip_address, expires_at, created_at
       FROM signature_requests WHERE contract_id = $1 ORDER BY created_at DESC`,
      [contractId]
    );

    return result.rows.map((r) => ({
      id: r.id,
      contractId: r.contract_id,
      signerEmail: r.signer_email,
      signerName: r.signer_name,
      token: '', // never expose token in list
      status: r.status,
      signedAt: r.signed_at,
      declinedAt: r.declined_at,
      declineReason: r.decline_reason,
      ipAddress: r.ip_address,
      expiresAt: r.expires_at,
      createdAt: r.created_at,
    }));
  }
}

export const signatureService = new SignatureService();
export default signatureService;
