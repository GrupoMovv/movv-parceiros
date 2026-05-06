const variants = {
  pending:   'badge-pending',
  converted: 'badge-converted',
  expired:   'badge-expired',
  paid:      'badge-paid',
  approved:  'badge-approved',
};

export default function Badge({ status, children }) {
  return (
    <span className={variants[status] || 'badge-pending'}>
      {children}
    </span>
  );
}
