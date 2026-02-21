export const INDUSTRY_TEMPLATES: any = {
    general: [
        {
            name: "Team Tasks",
            description: "Daily team work and priorities",
            tasks: [
                { title: "Review weekly priorities", status: "TODO", priority: "MEDIUM" },
                { title: "Team check-in meeting", status: "TODO", priority: "LOW" },
                { title: "Prepare monthly report", status: "IN_PROGRESS", priority: "HIGH" },
                { title: "Workspace setup complete", status: "DONE", priority: "LOW" },
            ]
        },
        {
            name: "Projects",
            description: "Track active projects",
            tasks: [
                { title: "Website refresh", status: "TODO", priority: "MEDIUM" },
                { title: "Client onboarding workflow", status: "TODO", priority: "HIGH" },
                { title: "Q1 marketing push", status: "IN_PROGRESS", priority: "HIGH" },
            ]
        },
        {
            name: "Clients & Leads",
            description: "Track prospects and customers",
            tasks: [
                { title: "Acme Corp", status: "TODO", priority: "HIGH" },
                { title: "Bright Dental", status: "TODO", priority: "MEDIUM" },
                { title: "Summit Realty", status: "IN_PROGRESS", priority: "MEDIUM" },
            ]
        }
    ],

    software: [
        {
            name: "Sprint Board",
            description: "Development sprint tasks",
            tasks: [
                { title: "Implement login flow", status: "TODO", priority: "HIGH" },
                { title: "Fix dashboard bug", status: "IN_PROGRESS", priority: "HIGH" },
                { title: "Write API tests", status: "TODO", priority: "MEDIUM" },
            ]
        },
        {
            name: "Bug Tracker",
            description: "Track reported issues",
            tasks: [
                { title: "Login error on Safari", status: "TODO", priority: "HIGH" },
                { title: "Slow dashboard load", status: "TODO", priority: "MEDIUM" },
            ]
        },
        {
            name: "Roadmap",
            description: "Upcoming features",
            tasks: [
                { title: "Mobile app v1", status: "TODO", priority: "HIGH" },
                { title: "Reporting dashboard", status: "TODO", priority: "MEDIUM" },
            ]
        }
    ],

    accounting: [
        {
            name: "Client Work",
            description: "Active client tasks",
            tasks: [
                { title: "Smith Co bookkeeping", status: "TODO", priority: "HIGH" },
                { title: "Payroll processing", status: "IN_PROGRESS", priority: "HIGH" },
            ]
        },
        {
            name: "Monthly Close",
            description: "Month-end process",
            tasks: [
                { title: "Reconcile bank accounts", status: "TODO", priority: "HIGH" },
                { title: "Prepare reports", status: "TODO", priority: "MEDIUM" },
            ]
        },
        {
            name: "Tax Prep",
            description: "Tax preparation workflow",
            tasks: [
                { title: "Collect W-2s", status: "TODO", priority: "HIGH" },
                { title: "Prepare filings", status: "TODO", priority: "HIGH" },
            ]
        }
    ]
};
