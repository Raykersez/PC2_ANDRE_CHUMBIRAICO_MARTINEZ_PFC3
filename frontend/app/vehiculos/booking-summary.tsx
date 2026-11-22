import { clockRange, operationLabels } from './windows';

export type VehicleBooking = {
  code: string; plate: string; date: string; operation: string; bay: string;
  startsAt: number; endsAt: number; enteredAt: number | null; cancelledAt: number | null;
  exitedAt: number | null; stayMinutes: number | null;
};

const bookingDate = new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeZone: 'UTC' });
export const plateLabel = (plate: string) => plate.slice(0, 3) + '-' + plate.slice(3);

function bookingStatus(booking: VehicleBooking) {
  if (booking.cancelledAt !== null) return 'Cancelado';
  if (booking.exitedAt !== null) return 'Cerrado';
  return booking.enteredAt === null ? 'Confirmado' : 'Ingreso registrado';
}

export function BookingSummary({ booking }: { booking: VehicleBooking }) {
  return (
    <>
      <span className="status-chip logistics-status">{bookingStatus(booking)}</span>
      <strong className="code">{booking.code}</strong>
      <span>{plateLabel(booking.plate)}</span>
      <span>{operationLabels[booking.operation]} · Bahía {booking.bay}</span>
      <span>{bookingDate.format(new Date(booking.date))} · {clockRange(booking.startsAt, booking.endsAt)} (Lima)</span>
    </>
  );
}
