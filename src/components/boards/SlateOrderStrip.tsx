"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { reorderSlates } from "@/actions/admin";

/** Drag the chips to reorder slates (order drives the picks page and standings math). */
export default function SlateOrderStrip({
  leagueId,
  slates,
}: {
  leagueId: string;
  slates: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [order, setOrder] = useState(slates.map((s) => s.id));
  const [saving, startTransition] = useTransition();
  const names = new Map(slates.map((s) => [s.id, s.name]));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const next = arrayMove(order, order.indexOf(String(active.id)), order.indexOf(String(over.id)));
    setOrder(next);
    startTransition(async () => {
      await reorderSlates({ leagueId, orderedSlateIds: next });
      router.refresh();
    });
  }

  if (slates.length < 2) return null;

  return (
    <div className="card !py-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Slate order <span className="normal-case font-normal">— drag to rearrange</span>
        </p>
        {saving && <span className="text-xs text-slate-400">Saving…</span>}
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={order} strategy={horizontalListSortingStrategy}>
          <div className="mt-2 flex flex-wrap gap-2">
            {order.map((id, i) => (
              <Chip key={id} id={id} label={`${i + 1}. ${names.get(id) ?? ""}`} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function Chip({ id, label }: { id: string; label: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <button
      type="button"
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`cursor-grab touch-none rounded-full border px-3 py-1 text-sm font-semibold active:cursor-grabbing ${
        isDragging
          ? "z-10 border-indigo-500 bg-indigo-950 text-white shadow-lg"
          : "border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500"
      }`}
    >
      ⠿ {label}
    </button>
  );
}
