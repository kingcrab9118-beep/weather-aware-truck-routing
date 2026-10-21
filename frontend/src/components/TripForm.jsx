function toLocalInputValue(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export default function TripForm({ value, onChange, onSubmit, loading }) {
  const set = (key, v) => onChange({ ...value, [key]: v })

  return (
    <form
      className="panel"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit()
      }}
    >
      <h2>Trip inputs</h2>
      <div className="form-grid">
        <label>
          Origin
          <input
            required
            placeholder="e.g. Chicago, IL"
            value={value.origin}
            onChange={(e) => set('origin', e.target.value)}
          />
        </label>
        <label>
          Destination
          <input
            required
            placeholder="e.g. Denver, CO"
            value={value.destination}
            onChange={(e) => set('destination', e.target.value)}
          />
        </label>
        <label>
          Departure date / time
          <input
            required
            type="datetime-local"
            value={value.departure || toLocalInputValue()}
            onChange={(e) => set('departure', e.target.value)}
          />
        </label>
        <div className="row-2">
          <label>
            Load weight (lb)
            <input
              required
              type="number"
              min="0"
              step="100"
              value={value.load_lb}
              onChange={(e) => set('load_lb', e.target.value)}
            />
          </label>
          <label>
            Sample every
            <select
              value={value.sample_interval_mi}
              onChange={(e) => set('sample_interval_mi', Number(e.target.value))}
            >
              <option value={10}>10 miles</option>
              <option value={25}>25 miles</option>
              <option value={50}>50 miles</option>
            </select>
          </label>
        </div>
        <button className="btn-primary" type="submit" disabled={loading}>
          {loading ? <span className="loading-pulse">Analyzing weather & routes…</span> : 'Find safest routes'}
        </button>
      </div>
    </form>
  )
}

export { toLocalInputValue }
