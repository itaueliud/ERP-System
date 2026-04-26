import React from 'react';

export interface FooterLink {
  label: string;
  href: string;
}

export interface FooterProps {
  companyName?: string;
  year?: number;
  links?: FooterLink[];
  children?: React.ReactNode;
}

export function Footer({ companyName = 'TechSwiftTrix', year = new Date().getFullYear(), links, children }: FooterProps) {
  return (
    <footer className="bg-white border-t border-gray-200 py-4 px-6 text-sm text-gray-500">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
        <span>
          &copy; {year} {companyName}. All rights reserved.
        </span>
        {links && links.length > 0 && (
          <nav aria-label="Footer links">
            <ul className="flex gap-4">
              {links.map((link) => (
                <li key={link.href}>
                  <a href={link.href} className="hover:text-gray-700 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}
        {children}
      </div>
    </footer>
  );
}

export default Footer;
