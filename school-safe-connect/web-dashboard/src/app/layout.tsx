import './globals.css';
import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'School Safe Connect - Next-Gen Safety & Academic OS',
  description: 'Enterprise Centralized Multi-Tenant School Safety, Live Telematics and Communication System',
  icons: {
    icon: '/logo.png?v=2',
    apple: '/logo.png?v=2'
  }
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen antialiased bg-background text-foreground transition-colors duration-300">
        {children}
      </body>
    </html>
  );
}
