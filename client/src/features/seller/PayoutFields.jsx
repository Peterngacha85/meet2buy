import { Input } from '../../components/ui/Input.jsx';

export const emptyPayout = { type: 'till', tillNumber: '', paybillNumber: '', accountNumber: '', registeredName: '' };

/** Only send the fields that belong to the chosen payout type. */
export function payoutBody(p) {
  return p.type === 'till'
    ? { type: 'till', tillNumber: p.tillNumber, registeredName: p.registeredName }
    : { type: 'paybill', paybillNumber: p.paybillNumber, accountNumber: p.accountNumber, registeredName: p.registeredName };
}

/** Till (Buy Goods) or Paybill details. `errors` keys: tillNumber, paybillNumber, accountNumber, registeredName. */
export function PayoutFields({ value, onChange, errors = {} }) {
  const set = (field) => (e) => onChange({ ...value, [field]: e.target.value });

  return (
    <div className="space-y-4">
      <div role="radiogroup" aria-label="Payout type" className="grid grid-cols-2 gap-2">
        {[
          ['till', 'Till (Buy Goods)'],
          ['paybill', 'Paybill'],
        ].map(([type, label]) => (
          <button
            key={type}
            type="button"
            role="radio"
            aria-checked={value.type === type}
            onClick={() => onChange({ ...value, type })}
            className={`h-11 rounded-btn border text-sm font-semibold transition-colors ${
              value.type === type ? 'border-navy bg-navy text-white' : 'border-line bg-white text-navy hover:border-navy'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {value.type === 'till' ? (
        <Input
          label="Till number"
          inputMode="numeric"
          value={value.tillNumber}
          onChange={set('tillNumber')}
          error={errors.tillNumber}
          placeholder="e.g. 123456"
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Paybill number"
            inputMode="numeric"
            value={value.paybillNumber}
            onChange={set('paybillNumber')}
            error={errors.paybillNumber}
            placeholder="e.g. 522522"
          />
          <Input
            label="Account number"
            value={value.accountNumber}
            onChange={set('accountNumber')}
            error={errors.accountNumber}
            placeholder="e.g. your bank account"
          />
        </div>
      )}
      <Input
        label="Name registered on M-Pesa"
        hint="Shown when M-Pesa confirms the number. Meet2buy checks it before approving your shop."
        value={value.registeredName}
        onChange={set('registeredName')}
        error={errors.registeredName}
      />
    </div>
  );
}
