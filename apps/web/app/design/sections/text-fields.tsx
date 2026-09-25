import { TextField } from '@/components/ui/text-field'
import { copy } from '@/lib/copy'

export function TextFieldsSection() {
  const { label, hint, placeholder, error } = copy.design.samples
  return (
    <div className="flex flex-col gap-6">
      <TextField label={label} hint={hint} placeholder={placeholder} inputMode="tel" />
      <TextField label={label} hint={hint} error={error} defaultValue="۰۹۱" inputMode="tel" />
      <TextField label={label} hint={hint} disabled defaultValue="۰۹۱۲۳۴۵۶۷۸۹" inputMode="tel" />
    </div>
  )
}
