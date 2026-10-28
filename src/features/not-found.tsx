import { Link } from 'react-router-dom'
import { EmptyState } from '@/components/shared/empty-state'
import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  return (
    <EmptyState
      title="This corridor is empty"
      body="The route is not part of the first NEXORA milestone."
      action={
        <Button asChild>
          <Link to="/">Return to Discover</Link>
        </Button>
      }
    />
  )
}
