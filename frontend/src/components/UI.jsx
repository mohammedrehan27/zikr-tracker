import React from 'react';

export function Skeleton({ className = '', style = {} }) {
  return <div className={`skeleton ${className}`} style={style} />;
}

export function SkeletonCard() {
  return (
    <div className="card skeleton-card">
      <Skeleton className="skeleton-heading" />
      <Skeleton className="skeleton-text" />
      <Skeleton className="skeleton-text" style={{ width: '40%' }} />
    </div>
  );
}

export function Toast({ toasts, onDismiss }) {
  if (!toasts || toasts.length === 0) return null;
  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type || 'success'}`} onClick={() => onDismiss(t.id)}>
          {t.message}
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="empty-state">
      {Icon && <Icon />}
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action && <div className="mt-16">{action}</div>}
    </div>
  );
}

export function Avatar({ name, color, size = 'md' }) {
  const initial = name ? name.charAt(0).toUpperCase() : '?';
  const sizeClass = size === 'sm' ? 'avatar-sm' : size === 'lg' ? 'avatar-lg' : size === 'xl' ? 'avatar-xl' : '';
  return (
    <div className={`avatar ${sizeClass}`} style={{ backgroundColor: color || '#22b365' }}>
      {initial}
    </div>
  );
}

