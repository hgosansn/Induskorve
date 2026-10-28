import { useState } from 'react';
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { CityStore } from '../../application/city-store';
import { toast } from 'sonner';

export function JoinCityDialog({
  store,
  onOpenChange,
}: {
  store: CityStore;
  onOpenChange(open: boolean): void;
}) {
  const [name, setName] = useState(() => {
    try {
      return localStorage.getItem('onecity-name') ?? '';
    } catch {
      return '';
    }
  });
  return (
    <DialogContent className="sm:max-w-sm">
      <DialogHeader>
        <DialogTitle>Leave your mark.</DialogTitle>
        <DialogDescription>
          Choose a name. Your pedestrian joins the streets, and you can start
          building.
        </DialogDescription>
      </DialogHeader>
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          try {
            store.getState().join(name);
            try {
              localStorage.setItem('onecity-name', name.trim());
            } catch {
              /* Session remains usable without storage. */
            }
            onOpenChange(false);
            toast.success(`Welcome, ${name.trim()}.`);
          } catch (error) {
            toast.error(
              error instanceof Error ? error.message : 'Could not join.',
            );
          }
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="citizen-name">Citizen name</Label>
          <Input
            id="citizen-name"
            name="nickname"
            autoComplete="nickname"
            placeholder="Your name"
            required
            maxLength={24}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            type="button"
            onClick={() => onOpenChange(false)}
          >
            Keep watching
          </Button>
          <Button type="submit" disabled={!name.trim()}>
            Enter the city ↗
          </Button>
        </DialogFooter>
      </form>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Local prototype · identity and city saved in this browser. Names are not
        authenticated. This is not a multiplayer session.
      </p>
    </DialogContent>
  );
}
