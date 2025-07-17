import { Button } from '@/components/ui/button'
import Link from 'next/link'
import React from 'react'

const NotFound = () => {
  return (
    <div>
        <p>Oops! the page you were looking for is not found</p>
        <Link href="/"> 
            <Button>Return Home</Button>
        </Link>
    </div>
  )
}

export default NotFound