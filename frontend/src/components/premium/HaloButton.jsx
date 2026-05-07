import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'

function resolveComponent({ to, href }) {
  if (to) return Link
  if (href) return 'a'
  return 'button'
}

export default function HaloButton({
  children,
  className = '',
  variant = 'primary',
  to,
  href,
  icon: Icon,
  type = 'button',
  ...props
}) {
  const Comp = resolveComponent({ to, href })

  return (
    <motion.div whileHover={{ y: -2, scale: 1.01 }} whileTap={{ scale: 0.985 }} transition={{ duration: 0.24 }}>
      <Comp
        to={to}
        href={href}
        type={Comp === 'button' ? type : undefined}
        className={`halo-button halo-${variant} ${className}`.trim()}
        {...props}
      >
        {Icon ? <Icon className="h-4 w-4 shrink-0" /> : null}
        <span>{children}</span>
      </Comp>
    </motion.div>
  )
}
