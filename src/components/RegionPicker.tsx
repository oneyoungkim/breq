import { useState } from 'react'
import { REGION_GROUPS } from '../logic'
import { Chip, inputCls } from './ui'

export default function RegionPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const cities = Object.keys(REGION_GROUPS)
  const initialCity =
    cities.find((c) => REGION_GROUPS[c].includes(value)) ?? '서울'
  const [city, setCity] = useState(initialCity)
  const [custom, setCustom] = useState(false)

  return (
    <div>
      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
        {cities.map((c) => (
          <Chip
            key={c}
            active={!custom && city === c}
            onClick={() => {
              setCity(c)
              setCustom(false)
            }}
          >
            {c}
          </Chip>
        ))}
      </div>
      {!custom && (
        <div className="mt-3 flex flex-wrap gap-2">
          {REGION_GROUPS[city].map((r) => (
            <Chip key={r} active={value === r} onClick={() => onChange(r)}>
              {r}
            </Chip>
          ))}
        </div>
      )}
      {custom && (
        <input
          className={`${inputCls} mt-3`}
          placeholder="동네 이름 입력 (예: 속초 영랑호)"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoFocus
        />
      )}
      <button
        onClick={() => {
          setCustom(!custom)
          onChange('')
        }}
        className="mt-2.5 text-[12px] font-semibold text-mute underline underline-offset-2"
      >
        {custom ? '← 목록에서 고르기' : '찾는 동네가 없나요? 직접 입력하기'}
      </button>
    </div>
  )
}
