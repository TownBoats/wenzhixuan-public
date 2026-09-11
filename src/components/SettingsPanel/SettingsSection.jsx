import PropTypes from 'prop-types';

/** Shared surface and heading rhythm for every settings tab. */
export default function SettingsSection({ title, icon, description, children }) {
  return (
    <section className="min-w-0 rounded-md border border-paper-200 bg-paper-50 p-4 md:p-5">
      <header className="mb-4">
        <h3 className="flex flex-wrap items-center gap-2 text-h2 font-semibold text-ink-900">
          {icon}
          {title}
        </h3>
        {description && <p className="mt-2 text-small leading-relaxed text-ink-500">{description}</p>}
      </header>
      {children}
    </section>
  );
}

SettingsSection.propTypes = {
  title: PropTypes.node.isRequired,
  icon: PropTypes.node,
  description: PropTypes.node,
  children: PropTypes.node,
};
