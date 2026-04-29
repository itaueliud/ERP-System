import type { FAQCategory } from '../components/layout/FAQPanel';

// ─── Agents Portal ────────────────────────────────────────────────────────────
export const AGENTS_FAQS: FAQCategory[] = [
  {
    category: 'Getting Started',
    items: [
      {
        q: 'How do I register a new client?',
        a: 'Go to the "Capture Client" section. Fill in the client\'s name, phone, email, and location, then click "Next: Select Product". Choose either SYSTEM (ERP/software) or TST PlotConnect (property listings), complete the product details, select a payment plan, and enter the M-Pesa number to initiate the commitment payment.',
      },
      {
        q: 'What is a commitment payment?',
        a: 'A commitment payment is a small upfront fee paid by the client to confirm their interest. The amount depends on the payment plan:\n• Full Payment plan — KSh 500\n• 50/50 plan — KSh 750\n• Milestone plan — KSh 1,000\n\nAn M-Pesa STK Push is sent to the client\'s phone. Ask them to approve it immediately.',
      },
      {
        q: 'What happens if the M-Pesa STK Push fails?',
        a: 'The client is still saved in the system. The payment is marked as pending. You can initiate the payment manually later from the client\'s record, or ask your trainer to follow up.',
      },
    ],
  },
  {
    category: 'Clients & Leads',
    items: [
      {
        q: 'Where can I see all my clients?',
        a: 'Go to the "My Clients" section in the sidebar. All clients you have registered are listed there with their current status.',
      },
      {
        q: 'What do the client statuses mean?',
        a: 'New Lead — you just submitted the client\'s information.\nConverted — you selected a product and service for them.\nLead Activated — commitment payment confirmed (Full Payment plan).\nLead Qualified — commitment payment confirmed (50/50 or Milestone plan).\nNegotiation — a trainer is actively engaging the client.\nClosed Won — full deposit received and project created.',
      },
      {
        q: 'Can I edit a client\'s details after saving?',
        a: 'Basic edits (notes, contact info) can be made from the client record. Status changes and product changes must be done by your trainer or the Operations team.',
      },
      {
        q: 'What is TST PlotConnect?',
        a: 'TST PlotConnect is a property listing platform. When you register a client for PlotConnect, you capture their property details (type, location, rooms/units, price) and a placement tier (Top, Medium, or Basic). Only a trainer can modify the placement tier after submission.',
      },
    ],
  },
  {
    category: 'Payments & Commission',
    items: [
      {
        q: 'How is my commission calculated?',
        a: 'Commission is calculated based on the number of closed deals and the service amounts agreed. Your trainer can see your commission score. Payouts are processed by the CFO every Friday between 4:00 PM and 10:00 PM.',
      },
      {
        q: 'When do I get paid?',
        a: 'Agent payouts happen every Friday between 4:00 PM and 10:00 PM. Payments are sent directly to your registered M-Pesa or bank account. Make sure your payout details are set up correctly — contact your trainer if they are missing.',
      },
      {
        q: 'What payment plans can I offer clients?',
        a: '• Full Payment — client pays the full service amount upfront. Commitment: KSh 500.\n• 50/50 — client pays 50% upfront and 50% on delivery. Commitment: KSh 750.\n• Milestone (40-20-20-20) — client pays in four stages. Commitment: KSh 1,000.',
      },
    ],
  },
  {
    category: 'Communications & Reports',
    items: [
      {
        q: 'How do I log a communication with a client?',
        a: 'Go to the "Log Communication" section. Enter the client ID, select the communication type (Email, Phone, Meeting, Chat, or SMS), set the date and duration, then write a summary and outcome.',
      },
      {
        q: 'What is the daily report for?',
        a: 'The daily report lets you record what you accomplished, any challenges you faced, and your plan for the next day. It is reviewed by your trainer and the Head of Trainers. Submit it before end of day.',
      },
      {
        q: 'How do I chat with the CFO?',
        a: 'Use the "Chat with CFO" section in the sidebar. This is a real-time chat channel. Only use it for urgent financial or payment-related queries.',
      },
    ],
  },
];

// ─── Trainers Portal ──────────────────────────────────────────────────────────
export const TRAINERS_FAQS: FAQCategory[] = [
  {
    category: 'Overview & Navigation',
    items: [
      {
        q: 'What is the difference between the Trainer and Head of Trainers dashboards?',
        a: 'Trainers see their own agents, client leads from those agents, and their personal achievements. The Head of Trainers (HoT) sees all trainers and agents in their country, can reassign agents between trainers, create new agent accounts, and assign converted clients to Account Executives.',
      },
      {
        q: 'How do I switch between sections?',
        a: 'Use the sidebar on the left. Click any item to navigate. On mobile, tap the hamburger menu at the top left.',
      },
    ],
  },
  {
    category: 'Managing Agents',
    items: [
      {
        q: 'How do I set an agent\'s priority listing?',
        a: 'Go to "My Agents", find the agent, and click "Priority". Select Top, Medium, or Basic from the dropdown and click Save. This affects how the agent\'s clients are prioritised in the system.',
      },
      {
        q: 'How do I create a new agent account? (Head of Trainers only)',
        a: 'Go to "Add Agent". Fill in the agent\'s full name, phone number, ID number, country, and payment details (M-Pesa or bank). Upload a cover photo if available, then submit. The agent will receive login credentials.',
      },
      {
        q: 'How do I reassign an agent to a different trainer? (Head of Trainers only)',
        a: 'Go to "Agents", find the agent, click "Reassign Agent", select the new trainer from the dropdown, and click Save.',
      },
    ],
  },
  {
    category: 'Client Leads',
    items: [
      {
        q: 'Where do I see leads from my agents?',
        a: 'Go to "Client Leads". All clients submitted by your agents are listed here with their current status and payment status.',
      },
      {
        q: 'What does "Assign Converted Client" do? (Head of Trainers only)',
        a: 'Once a lead is converted to a project, the HoT can assign it to an Account Executive for ongoing client management. Go to "Assign Converted Client", enter the client ID and select the Account Executive.',
      },
    ],
  },
  {
    category: 'Reports & Achievements',
    items: [
      {
        q: 'What does the Achievements section show?',
        a: 'It shows trainer performance within your country — number of agents, deals closed, and leads generated. Revenue data is not shown at this level.',
      },
      {
        q: 'How do I submit my daily report?',
        a: 'Go to "Daily Report". Fill in your accomplishments, challenges, plan for tomorrow, and hours worked, then click Submit. Reports are reviewed by the Head of Trainers and Operations management.',
      },
    ],
  },
];

// ─── Operations Portal ────────────────────────────────────────────────────────
export const OPERATIONS_FAQS: FAQCategory[] = [
  {
    category: 'Clients & Leads',
    items: [
      {
        q: 'How do I add a client directly from Operations?',
        a: 'Go to "Clients" and click "Add Client". Fill in the client\'s name, email, phone, country, industry, estimated value, and service description, then click Add Client.',
      },
      {
        q: 'How do I filter the client list?',
        a: 'Use the filter bar above the client table. You can filter by status, country, agent name, or search by client name/email. Click "Clear" to reset all filters.',
      },
      {
        q: 'How do I qualify a lead?',
        a: 'Go to "Leads", find the lead, and click "Qualify". Enter the estimated value and priority level, then click "Confirm Qualify". The lead status will update to Qualified Lead.',
      },
      {
        q: 'How do I convert a qualified lead to a project?',
        a: 'Find the lead in "Leads" (it must be in Qualified Lead status), click "Convert", enter the service amount, select the client\'s country (currency auto-fills), set start and end dates, then click "Confirm Convert". A project is created and a contract can be generated from the Executive Portal.',
      },
      {
        q: 'How do I update multiple leads at once?',
        a: 'In the "Leads" section, check the boxes next to the leads you want to update. A bulk action bar appears at the top — select the target stage from the dropdown and click "Apply". All selected leads will move to that stage.',
      },
      {
        q: 'How do I export clients or leads to CSV?',
        a: 'Click the "Export CSV" button at the top right of the Clients or Leads section. A CSV file will download with all visible records.',
      },
    ],
  },
  {
    category: 'Tasks',
    items: [
      {
        q: 'How do I create a task?',
        a: 'Go to "Tasks" and click "Create Task". Fill in the title, description, due date, priority, and assign it to a team member. Click "Create Task" to save.',
      },
      {
        q: 'Does the assigned person get notified?',
        a: 'Yes. When you assign a task to someone, they receive an in-portal notification with the task title and due date. They will see it in their notifications bell.',
      },
      {
        q: 'How do I mark a task as complete?',
        a: 'In the Tasks table, click the "Complete" button on the task row. The status will update to Completed.',
      },
    ],
  },
  {
    category: 'Properties',
    items: [
      {
        q: 'How do I add a property listing?',
        a: 'Go to "Properties" and click "Add Property". Switch to the "New Property" tab, fill in the title, description, location, country, price, property type, and size, then submit.',
      },
      {
        q: 'What property types are supported?',
        a: 'Land, Residential, Commercial, Industrial, and Agricultural.',
      },
    ],
  },
  {
    category: 'Reports & Communications',
    items: [
      {
        q: 'Where do I see team daily reports?',
        a: 'Go to "Reports". All daily reports submitted by your team are listed. Click "View" on any row to see the full report details.',
      },
      {
        q: 'How do I view communication history?',
        a: 'Go to "Communications". All client communications logged by agents are shown here. Click "View" to see the full summary and outcome.',
      },
    ],
  },
];

// ─── Technology Portal ────────────────────────────────────────────────────────
export const TECHNOLOGY_FAQS: FAQCategory[] = [
  {
    category: 'General',
    items: [
      {
        q: 'Why do I see a different dashboard from my colleague?',
        a: 'The Technology Portal uses role-based access (RBA). Your view depends on your role and department:\n• TECH_STAFF (Infrastructure & Security dept) → Security/Infra dashboard\n• TECH_STAFF (Software Engineering dept) → Software Eng dashboard\n• DEVELOPER / CTO → Engineering Operations dashboard',
      },
      {
        q: 'How do I link my GitHub account?',
        a: 'Contact your CTO to have your GitHub username added to your profile. Once linked, your commits and PRs will appear in the GitHub sections.',
      },
    ],
  },
  {
    category: 'Infrastructure & Security (Dept 1)',
    items: [
      {
        q: 'How do I view live server metrics?',
        a: 'Go to "Infrastructure Health". The metrics (status, uptime, memory, database, cache) are pulled live from the backend health endpoint. Click "Refresh" to get the latest data.',
      },
      {
        q: 'How do I log an incident?',
        a: 'Go to "Incident Log", fill in the title, severity (Low/Medium/High/Critical), affected system, and description/resolution notes, then click "Log Incident". You can resolve it later by clicking "Resolve" on the incident row.',
      },
      {
        q: 'How do I record a deployment?',
        a: 'Go to "Deployment Log", enter the service name, version/tag, environment (Production/Staging/Development), and any notes, then click "Log Deployment".',
      },
    ],
  },
  {
    category: 'Software Engineering (Dept 2)',
    items: [
      {
        q: 'How do I create a sprint?',
        a: 'Go to "Sprint Planning", fill in the sprint name, start date, end date, and goal, then click "Create Sprint". Sprints are used to group kanban items into time-boxed delivery cycles.',
      },
      {
        q: 'How do I assign a reviewer to a pull request?',
        a: 'Go to "GitHub PRs & Commits", find the PR in the Pull Requests table, click "Assign" in the Assign Reviewer column, type the GitHub username, and click "Assign".',
      },
      {
        q: 'How do I move a feature card on the kanban board?',
        a: 'The kanban board in "Feature Board" shows items filtered by status (To Do, In Progress, Review, Done). Status changes are made via the backend — contact your team lead to update a card\'s status.',
      },
    ],
  },
  {
    category: 'Engineering Operations (Dept 3)',
    items: [
      {
        q: 'How do I log time against a project?',
        a: 'Go to "Time Tracking", select the project from the dropdown, enter the hours worked, set the date, add a description, and click "Log Time".',
      },
      {
        q: 'Who can create a developer team?',
        a: 'Only the CTO can create developer teams. Go to "Teams" and click "+ Create Team". Each team has exactly 3 developers and one designated Team Leader.',
      },
      {
        q: 'How do I download a contract?',
        a: 'Go to "Contracts". Find your team\'s contract and click "Download". Team Leaders can also send signature requests by clicking "Sign".',
      },
      {
        q: 'Can non-leader developers use the chat?',
        a: 'No. Chat is restricted to Team Leaders only. Non-leader members can view conversations but cannot send messages.',
      },
    ],
  },
];

// ─── C-Level Portal (COO & CTO) ───────────────────────────────────────────────
export const CLEVEL_FAQS: FAQCategory[] = [
  {
    category: 'COO Dashboard',
    items: [
      {
        q: 'What data does the COO Overview show?',
        a: 'The overview shows clients added by your team, active leads in the group, closed deals, and the number of daily reports submitted vs total team members.',
      },
      {
        q: 'How do I submit a budget request?',
        a: 'Go to "Budget & Expenses" and fill in the Budget Request form with the amount, purpose, and department. Click "Submit Budget Request". It will be reviewed and approved by the CFO, CoS, or CEO.',
      },
      {
        q: 'How do I submit an expense report?',
        a: 'In "Budget & Expenses", use the Expense Report form. Select a category, enter the amount and description, then submit. Approved expenses are tracked in the same section.',
      },
      {
        q: 'How do I see team daily reports?',
        a: 'Go to "Reports". All daily reports from your team are listed. Click "View" on any row to see the full report including accomplishments, challenges, and tomorrow\'s plan.',
      },
    ],
  },
  {
    category: 'CTO Dashboard',
    items: [
      {
        q: 'How do I assign a project to a developer team?',
        a: 'Go to "Contracts & Project Assignment". In the assignment panel, select the project from the dropdown and the developer team, then click "Assign Project to Team". The team will see the project in their Engineering Operations dashboard.',
      },
      {
        q: 'How do I see team velocity?',
        a: 'Go to "Team Velocity". Each team card shows the number of features done, in progress, and commits this sprint. The table below gives a summary across all teams.',
      },
      {
        q: 'How do I see member performance scores?',
        a: 'Go to "Member Performance". Scores are calculated from daily report submission frequency and average hours worked over the last 30 days. Higher scores mean more consistent reporting and longer working hours.',
      },
      {
        q: 'How do I view GitHub org-level stats?',
        a: 'Go to "GitHub". The top stat cards show total commits (last 7 days), open PRs, open issues, and active repos across all linked repositories.',
      },
      {
        q: 'How do I submit a tech funding request?',
        a: 'Go to "Tech Funding". Fill in the project name, amount, and justification, then submit. The request goes to the CFO, CoS, or CEO for approval.',
      },
      {
        q: 'How do I add a new trainer or developer?',
        a: 'Go to "Add Members". Use the tabs to add a Trainer, Head of Trainers, CTO Dept Member, assign a Team Leader, or create a full Developer Team. An invitation email is sent to the new member.',
      },
    ],
  },
  {
    category: 'Payments & Approvals',
    items: [
      {
        q: 'How do I submit a payment request?',
        a: 'Go to "Payment Request". Select a project (optional), enter the amount and purpose, then click "Submit Payment Request". The request is reviewed by the CFO, CoS, or CEO.',
      },
      {
        q: 'Who approves payment requests?',
        a: 'Payment requests are approved by the CFO, Chief of Staff (CoS), or CEO. Once approved, the same person who approved it can execute the payment.',
      },
    ],
  },
];

// ─── Executive Portal (CFO, CoS, EA) ─────────────────────────────────────────
export const EXECUTIVE_FAQS: FAQCategory[] = [
  {
    category: 'CFO — Payments & Finance',
    items: [
      {
        q: 'How do I approve a payment request?',
        a: 'Go to "Payment Management". Pending requests are listed at the top. Click "Approve" to approve or "Reject" (with a reason) to reject. Once approved, the payment moves to "Approved — Pending Execution" status.',
      },
      {
        q: 'How do I execute an approved payment?',
        a: 'In "Payment Management", find the approved payment. Click "Execute", select the payment method (Bank Transfer, M-Pesa, or Airtel Money), then click "Confirm Execute". Only the person who approved the payment can execute it.',
      },
      {
        q: 'How do I pay staff?',
        a: 'Go to "Pay Staff". Select staff members using the checkboxes, enter individual amounts (or use "Set amount for all selected" for bulk), add a run label and payment type, then click "Pay". Funds are sent directly to their M-Pesa or bank account.',
      },
      {
        q: 'How do I filter payment run history?',
        a: 'In "Pay Staff", scroll to "Payment History". Use the date range pickers, status filter (Completed/Partial/Failed), and type filter (Salary/Staff Support/General) to narrow down runs.',
      },
      {
        q: 'What is the P&L Summary?',
        a: 'Go to "P&L Summary". It shows total revenue, total expenses, and net profit at a glance, plus a monthly breakdown table. Data is pulled from the finance module.',
      },
      {
        q: 'How does the Revenue Forecast work?',
        a: 'Go to "Revenue Forecast". The system calculates: Pipeline Value × Historical Close Rate = Projected Next Month Revenue. It also shows a breakdown of the pipeline by stage so you can see where value is concentrated.',
      },
      {
        q: 'How do I set the TOT rate?',
        a: 'Go to "Finance Module", scroll to "ToT Percentage Setting", enter the rate (e.g. 1.5), and click Save.',
      },
    ],
  },
  {
    category: 'CFO — Tax & Compliance',
    items: [
      {
        q: 'Where do I see tax filing records?',
        a: 'Go to "Tax & Compliance". TOT/VAT records are in the first table, PAYE & NSSF records in the second. Click "Generate Tax Report" to download a PDF.',
      },
      {
        q: 'What is the Anti-Corruption section?',
        a: 'It shows the full audit trail of all system actions, cross-check alerts for suspicious activity, and fraud flag reports. Use it to investigate anomalies.',
      },
    ],
  },
  {
    category: 'CoS — Oversight & Coordination',
    items: [
      {
        q: 'What does the CoS see in Financial Visibility?',
        a: 'Total revenue, daily cash flow, monthly P&L breakdown, and tax reports. The CoS has read-only visibility into financial data — changes must go through the CFO.',
      },
      {
        q: 'How do I see all portal daily reports?',
        a: 'Go to "All Portal Reports". Reports from all portals are aggregated here. Use the search bar to find a specific person, or filter by portal.',
      },
      {
        q: 'How do I flag an issue for the CEO?',
        a: 'Go to "Escalation Tracker". Fill in the title, priority, and description, then click "Flag for CEO". The CEO will see it in their dashboard. You can mark it as resolved once addressed.',
      },
      {
        q: 'How do I approve budget or tech funding requests?',
        a: 'Go to "Coordination Tools". Budget requests from the COO and tech funding requests from the CTO are listed. Click "Approve" or "Reject" on each. Approved budget requests can then be executed.',
      },
    ],
  },
  {
    category: 'EA — Contracts & Agents',
    items: [
      {
        q: 'How do I generate a contract?',
        a: 'Go to "Contract Generator". Select the project and client, fill in the contract details, and click Generate. The contract PDF is created and can be downloaded or sent for signature.',
      },
      {
        q: 'How do I see all contracts by status?',
        a: 'Go to "Contract Status Board". Contracts are grouped into four columns: Draft, Sent, Signed, and Expired. Each card shows the reference number, client, team, and date.',
      },
      {
        q: 'How do I compare agent performance across regions?',
        a: 'Go to "Agent Comparison". All agents are listed in a table sorted by performance score (highest first). You can see their region, country, deals, leads, and a visual score bar.',
      },
      {
        q: 'How do I add a new region or country?',
        a: 'Go to "Region & Country". Use the "Add Region" form to create a new region, then use "Add Country" to assign a country to a region.',
      },
      {
        q: 'Can the EA approve or execute payments?',
        a: 'No. The EA role does not have payment approval or execution permissions. Payment actions are handled by the CFO, CoS, or CEO only.',
      },
    ],
  },
];

// ─── CEO Portal ───────────────────────────────────────────────────────────────
export const CEO_FAQS: FAQCategory[] = [
  {
    category: 'Dashboard & Overview',
    items: [
      {
        q: 'What does the CEO dashboard show?',
        a: 'The CEO dashboard gives a full company-wide view: revenue, active leads, closed deals, projects, team performance, and financial health. All data is aggregated across all portals and countries.',
      },
      {
        q: 'How do I navigate between sections?',
        a: 'Use the sidebar on the left. Sections include Overview, Clients, Projects, Revenue, Payments, Agents, Trainers, Reports, and Admin (Control Panel). Click any item to switch.',
      },
    ],
  },
  {
    category: 'Payments & Approvals',
    items: [
      {
        q: 'How do I approve a payment request?',
        a: 'Go to "Payments". Pending requests are listed. Click "Approve" to approve or "Reject" with a reason. Once approved, click "Execute" to send the funds.',
      },
      {
        q: 'How do I approve a service amount change?',
        a: 'Service amount changes are proposed by the EA or CoS and require CEO approval. Go to "Service Amounts" in the Admin section. Pending proposals will have an Approve/Reject button.',
      },
    ],
  },
  {
    category: 'Admin — Control Panel',
    items: [
      {
        q: 'How do I manage user accounts?',
        a: 'Go to "Admin" → "Control" tab → "Users". You can view all users, edit their roles, and suspend accounts. Use the search/filter to find specific users.',
      },
      {
        q: 'How do I enable or disable a portal?',
        a: 'Go to "Admin" → "Portals" tab. Each portal is listed with its current status. Click "Disable" to take a portal offline (it will return 503 to all users) or "Enable" to restore it. The CEO portal itself cannot be disabled.',
      },
      {
        q: 'How do I view audit logs?',
        a: 'Go to "Admin" → "Control" tab → "Audit" sub-tab. All system actions are logged with the user, action, and timestamp.',
      },
      {
        q: 'How do I manage active sessions?',
        a: 'Go to "Admin" → "Control" tab → "Sessions". All active user sessions are listed. You can terminate a session by clicking "Revoke".',
      },
      {
        q: 'How do I manage backups?',
        a: 'Go to "Admin" → "Control" tab → "Backup". You can trigger a manual backup, view backup history, and configure the backup email address.',
      },
      {
        q: 'How do I check system health?',
        a: 'Go to "Admin" → "Health" tab. Live metrics for database, cache, memory, and uptime are shown. Click "Refresh" to get the latest data.',
      },
      {
        q: 'How do I manage integrations?',
        a: 'Go to "Admin" → "Integrations" tab. All third-party integrations (M-Pesa, SendGrid, GitHub, etc.) are listed with their API keys. Click "Edit" to update a key.',
      },
    ],
  },
  {
    category: 'Reports & Escalations',
    items: [
      {
        q: 'Where do I see escalations from the CoS?',
        a: 'Escalations flagged by the Chief of Staff appear as notifications. You can also view them in the Reports section. Each escalation has a priority level and can be marked as resolved.',
      },
      {
        q: 'How do I view company-wide performance?',
        a: 'The Overview section shows all key metrics. For deeper analysis, go to Revenue (financial breakdown), Agents (agent performance by country), and Trainers (trainer performance).',
      },
    ],
  },
];
