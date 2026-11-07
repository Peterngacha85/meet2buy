export function Card({ as: Tag = 'div', className = '', children, ...props }) {
  return (
    <Tag className={`rounded-card border border-line bg-white ${className}`} {...props}>
      {children}
    </Tag>
  );
}
