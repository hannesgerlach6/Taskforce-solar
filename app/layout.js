import './globals.css'

export const metadata = {
  title: 'TASK-FORCE Solar CRM',
  description: 'Meisterbetrieb für Photovoltaik',
}

export default function RootLayout({ children }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  )
}
