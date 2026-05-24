import type { NextPageContext } from 'next'

interface ErrorProps {
  statusCode: number | null
}

function Error({ statusCode }: ErrorProps) {
  return (
    <main className="min-h-screen p-8">
      <h1 className="text-2xl font-semibold mb-2">
        {statusCode != null ? `Error ${statusCode}` : 'An error occurred'}
      </h1>
    </main>
  )
}

Error.getInitialProps = ({ res, err }: NextPageContext): ErrorProps => {
  const statusCode = res ? res.statusCode : err ? (err.statusCode ?? null) : 404
  return { statusCode: statusCode ?? null }
}

export default Error
