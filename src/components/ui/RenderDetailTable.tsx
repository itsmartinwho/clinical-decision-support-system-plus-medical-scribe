'use client';
import React from 'react';
import { cn } from '@/lib/utils';

const MONO = new Set(['code', 'value', 'units', 'dateTime', 'referenceRange', 'dosage', 'flag']);

// A small table of chart rows (diagnoses, labs, treatments): a table on wide
// screens, one block per row on a phone. Codes, values and dates are set in
// the mono face so they line up.
export default function RenderDetailTable({ title, dataArray, headers, columnAccessors }: {
  title: string;
  dataArray: Record<string, any>[];
  headers: string[];
  columnAccessors?: string[];
}) {
  const rows = Array.isArray(dataArray) ? dataArray : [];
  const accessors = columnAccessors || headers.map(h => h.toLowerCase().replace(/\s+/g, ''));
  const show = (v: unknown, key: string) => {
    if (v === undefined || v === null || v === '') return '—';
    if (key === 'dateTime' && typeof v === 'string' && !Number.isNaN(Date.parse(v))) {
      return new Date(v).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
    return typeof v === 'object' ? JSON.stringify(v) : String(v);
  };

  return (
    <section className="mt-5">
      {title ? <h4 className="mb-2 flex items-center gap-2 text-sm font-medium text-ink">
        {title}
        <span className="data-mono inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-well px-1.5 text-[0.6875rem] text-muted-foreground ring-1 ring-hairline">{rows.length}</span>
      </h4> : null}
      {rows.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">No {title.toLowerCase()} data available</p>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl border border-hairline sm:block"><table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-hairline bg-well/70">
                {headers.map(h => <th key={h} scope="col" className="label-caps px-3 py-2 text-left">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((item, index) => (
                <tr key={index} className="border-b border-hairline align-top last:border-0">
                  {accessors.map((a) => (
                    <td key={a} className={cn('px-3 py-2.5 text-ink', MONO.has(a) && 'data-mono text-[0.8125rem]')}>{show(item[a], a)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table></div>
          <ul className="divide-y divide-hairline overflow-hidden rounded-xl border border-hairline sm:hidden">
            {rows.map((item, index) => (
              <li key={index} className="px-3 py-2.5">
                <dl className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-3 gap-y-0.5 text-sm">
                  {accessors.map((a, i) => (
                    <React.Fragment key={a}>
                      <dt className="text-muted-foreground">{headers[i]}</dt>
                      <dd className={cn('text-ink', MONO.has(a) && 'data-mono text-[0.8125rem]')}>{show(item[a], a)}</dd>
                    </React.Fragment>
                  ))}
                </dl>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
