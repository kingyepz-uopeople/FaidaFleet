# **App Name**: FaidaFleet

## Core Features:

- Vehicle and Driver Tracking: Digital tracking of vehicles, drivers, and shifts, associating drivers and vehicles with a specific tenant ID.
- Cash and M-Pesa Collection Recording: Record daily cash and M-Pesa collections, storing all transactional data in the Supabase database, tagged with the respective tenant ID.
- Expense and Maintenance Logging: Log expenses and maintenance records per vehicle, linking all entries to the appropriate tenant ID within the Supabase database.
- Profitability Dashboard: Display key performance metrics such as daily cash vs. M-Pesa totals, total expenses per vehicle, and net income per vehicle/shift/date using Supabase materialized views.
- Automated Reconciliation Tool: Implement an automated reconciliation tool that uses the amount, MSISDN, vehicle code, and timestamp to match and reconcile M-Pesa transactions, managed via Supabase edge functions.
- User Role Management: Manage user roles (Owner, Admin, Accountant, Driver) with permissions enforced via Supabase RLS, allowing granular access control to tenant data.

## Style Guidelines:

- Primary color: Deep blue (#3F51B5) to convey trust and reliability, reflecting the app's role in managing finances.
- Background color: Light grey (#F5F5F5) to provide a clean and neutral backdrop, ensuring legibility and reducing visual fatigue.
- Accent color: Soft teal (#80CBC4) to highlight key interactive elements, balancing professionalism with approachability.
- Body and headline font: 'PT Sans', a humanist sans-serif font suitable for both headlines and body text.
- Use clear and recognizable icons from the Font Awesome or Material Design icon sets to represent vehicles, drivers, transactions, and other key elements.
- Maintain a clean and structured layout using Tailwind CSS and ShadCN UI components, optimized for both desktop and mobile views, with a focus on usability for field staff.
- Incorporate subtle transitions and animations to provide feedback on user interactions and improve the overall user experience without being distracting.