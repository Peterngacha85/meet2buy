import { Button } from '../components/ui/Button.jsx';

export function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-20 text-center">
      <p className="font-display text-6xl font-extrabold text-orange">404</p>
      <h1 className="mt-4 text-2xl font-bold">This shop doesn&rsquo;t exist</h1>
      <p className="mt-2 text-muted">The page may have moved, or the store may have closed.</p>
      <Button to="/" className="mt-6">
        Back to the mall
      </Button>
    </div>
  );
}
