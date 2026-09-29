import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const topics = [
  {
    href: '/vehicles',
    title: 'Vehicles and compliance',
    body: 'Register each matatu with its plate number, insurance expiry, and inspection date. The dashboard flags dates that have passed or fall within 30 days.',
  },
  {
    href: '/collections',
    title: 'Daily collections',
    body: 'Record cash, M-Pesa, and Pochi takings against a vehicle and driver. Cash is stored as recorded. M-Pesa and Pochi stay pending until they are reconciled.',
  },
  {
    href: '/expenses',
    title: 'Expenses',
    body: 'Log fuel, maintenance, insurance, and other costs. Analytics and the dashboard subtract these from collections for the same dates.',
  },
  {
    href: '/trips',
    title: 'Trips',
    body: 'Record a trip’s distance, earnings, and costs. Driver Stats uses trip costs as that driver’s expenses.',
  },
  {
    href: '/driver-analytics',
    title: 'Driver Stats',
    body: 'The leaderboard ranks active drivers by collections minus the costs on their trips.',
  },
  {
    href: '/settings',
    title: 'Fleet settings',
    body: 'Owners can rename the fleet. The team tab lists active members and roles. Password changes ask for the current password first.',
  },
]

export default function HelpPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Help</h1>
        <p className="text-gray-600 dark:text-gray-400">How the fleet records fit together.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {topics.map((topic) => (
          <Card key={topic.href}>
            <CardHeader>
              <CardTitle>
                <Link href={topic.href} className="hover:underline">
                  {topic.title}
                </Link>
              </CardTitle>
              <CardDescription>{topic.body}</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href={topic.href} className="text-sm font-medium text-blue-600 hover:underline">
                Open
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
