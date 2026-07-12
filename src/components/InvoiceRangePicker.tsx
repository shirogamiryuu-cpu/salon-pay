import { useState } from "react";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { RangeMode } from "@/lib/invoice-range";

export function InvoiceRangePicker(props: {
  mode: RangeMode;
  fromISO: string;
  toISO: string;
  session?: string;
  onChange: (next: {
    mode: RangeMode;
    from?: string;
    to?: string;
    session?: string;
  }) => void;
}) {
  const { mode, fromISO, toISO, session } = props;
  const [dayValue, setDayValue] = useState(fromISO);
  const [monthValue, setMonthValue] = useState(fromISO.slice(0, 7));
  const [rangeFrom, setRangeFrom] = useState(fromISO);
  const [rangeTo, setRangeTo] = useState(toISO);

  if (session) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border p-3 print:hidden">
        <div className="text-sm">Viewing a single session invoice.</div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => props.onChange({ mode: "month", from: format(new Date(), "yyyy-MM") })}
        >
          Switch to month
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-md border p-3 print:hidden space-y-3">
      <div className="flex flex-wrap gap-1">
        {(["day", "month", "custom"] as const).map((m) => (
          <button
            key={m}
            onClick={() => {
              if (m === "day") props.onChange({ mode: "day", from: dayValue });
              else if (m === "month") props.onChange({ mode: "month", from: monthValue });
              else props.onChange({ mode: "custom", from: rangeFrom, to: rangeTo });
            }}
            className={`px-3 py-1 text-xs rounded-sm border ${
              mode === m ? "bg-primary text-primary-foreground border-primary" : "text-muted-foreground"
            }`}
          >
            {m === "day" ? "Day" : m === "month" ? "Month" : "Date range"}
          </button>
        ))}
      </div>

      {mode === "day" && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Date</Label>
            <Input
              type="date"
              value={dayValue}
              onChange={(e) => {
                setDayValue(e.target.value);
                props.onChange({ mode: "day", from: e.target.value });
              }}
              className="w-[160px]"
            />
          </div>
          <QuickBtns
            onToday={() => {
              const v = format(new Date(), "yyyy-MM-dd");
              setDayValue(v);
              props.onChange({ mode: "day", from: v });
            }}
            onYesterday={() => {
              const d = new Date();
              d.setDate(d.getDate() - 1);
              const v = format(d, "yyyy-MM-dd");
              setDayValue(v);
              props.onChange({ mode: "day", from: v });
            }}
          />
        </div>
      )}

      {mode === "month" && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Month</Label>
            <Input
              type="month"
              value={monthValue}
              onChange={(e) => {
                setMonthValue(e.target.value);
                props.onChange({ mode: "month", from: e.target.value });
              }}
              className="w-[180px]"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const v = format(new Date(), "yyyy-MM");
              setMonthValue(v);
              props.onChange({ mode: "month", from: v });
            }}
          >
            This month
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const d = new Date();
              d.setMonth(d.getMonth() - 1);
              const v = format(d, "yyyy-MM");
              setMonthValue(v);
              props.onChange({ mode: "month", from: v });
            }}
          >
            Last month
          </Button>
        </div>
      )}

      {mode === "custom" && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label className="text-xs">From</Label>
            <Input
              type="date"
              value={rangeFrom}
              max={rangeTo}
              onChange={(e) => {
                setRangeFrom(e.target.value);
                props.onChange({ mode: "custom", from: e.target.value, to: rangeTo });
              }}
              className="w-[160px]"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">To</Label>
            <Input
              type="date"
              value={rangeTo}
              min={rangeFrom}
              onChange={(e) => {
                setRangeTo(e.target.value);
                props.onChange({ mode: "custom", from: rangeFrom, to: e.target.value });
              }}
              className="w-[160px]"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function QuickBtns({ onToday, onYesterday }: { onToday: () => void; onYesterday: () => void }) {
  return (
    <>
      <Button variant="outline" size="sm" onClick={onToday}>Today</Button>
      <Button variant="outline" size="sm" onClick={onYesterday}>Yesterday</Button>
    </>
  );
}
