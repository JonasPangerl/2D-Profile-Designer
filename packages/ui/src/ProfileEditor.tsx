/**
 * The SVG editing surface.
 *
 * Everything that converts a pointer position into a document coordinate
 * happens in `clientToWorld` here and nowhere else. Two places doing it is
 * the "one door per concern" failure the workflow warns about, and it would
 * show up as a drag that tracks the cursor correctly at one zoom level and
 * drifts at another.
 */

import { useCallback, useMemo, useRef, useState } from "react";
import {
  buildComb,
  contourToWorld,
  findInflections,
  resolveElement,
  sampleElement,
  setAnchor,
  toLocal,
  vec,
} from "@foil/geometry";
import type { Anchor, CombTooth, Point, ResolvedElement } from "@foil/geometry";
import { AnchorHandles, RADIUS_HANDLE_CAP, derivedAt } from "./AnchorHandles.js";
import type { HandleTarget } from "./AnchorHandles.js";
import { useEditor } from "./store.js";

export interface ProfileEditorProps {
  readonly combGain?: number;
  readonly showComb?: boolean;
  readonly width?: number;
  readonly height?: number;
}

interface Rendered {
  readonly id: string;
  readonly element: ResolvedElement;
  readonly contour: readonly Point[];
  readonly comb: readonly CombTooth[];
  readonly inflections: readonly Point[];
}

function pathFrom(points: readonly Point[]): string {
  if (points.length === 0) return "";
  const head = points[0] as Point;
  const rest = points
    .slice(1)
    .map((p) => `L ${p.x.toFixed(6)} ${p.y.toFixed(6)}`)
    .join(" ");
  return `M ${head.x.toFixed(6)} ${head.y.toFixed(6)} ${rest} Z`;
}

function boundsOf(all: readonly Point[]): { x: number; y: number; w: number; h: number } {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const p of all) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  if (!Number.isFinite(minX)) return { x: 0, y: 0, w: 1, h: 1 };
  const pad = 0.12 * Math.max(maxX - minX, maxY - minY, 1e-6);
  return { x: minX - pad, y: minY - pad, w: maxX - minX + 2 * pad, h: maxY - minY + 2 * pad };
}

export function ProfileEditor({
  combGain = 0.05,
  showComb = true,
  width = 960,
  height = 420,
}: ProfileEditorProps): JSX.Element {
  const doc = useEditor((s) => s.doc);
  const selection = useEditor((s) => s.selection);
  const hidden = useEditor((s) => s.hidden);
  const apply = useEditor((s) => s.apply);
  const endCoalescing = useEditor((s) => s.endCoalescing);
  const select = useEditor((s) => s.select);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const [dragging, setDragging] = useState<HandleTarget | null>(null);

  const rendered = useMemo<Rendered[]>(
    () =>
      doc.elements
        .filter((spec) => !hidden.has(spec.id))
        .map((spec) => {
          const element = resolveElement(spec);
          const samples = sampleElement(element, { count: 200 });
          return {
            id: spec.id,
            element,
            contour: contourToWorld(
              samples.map((s) => s.point),
              spec.placement,
            ),
            comb: showComb
              ? buildComb(samples, { gain: combGain }).map((tooth) => ({
                  base: contourToWorld([tooth.base], spec.placement)[0] as Point,
                  tip: contourToWorld([tooth.tip], spec.placement)[0] as Point,
                  kappa: tooth.kappa,
                }))
              : [],
            inflections: contourToWorld(
              findInflections(samples, element.leIndex)
                .filter((m) => m.onSuctionSide)
                .map((m) => m.point),
              spec.placement,
            ),
          };
        }),
    [doc, hidden, showComb, combGain],
  );

  const view = boundsOf(rendered.flatMap((r) => r.contour));
  const scale = Math.max(view.w, view.h) / 400;

  /**
   * Pointer position in world coordinates.
   *
   * It goes through the SVG's own screen CTM rather than through
   * arithmetic on the viewBox, so it stays correct when CSS scales the
   * element - which it does, because the stylesheet gives the svg
   * `width: 100%`. The `-p.y` undoes the single `scale(1, -1)` the scene
   * group applies, and that flip is undone here and nowhere else.
   */
  const clientToWorld = useCallback((clientX: number, clientY: number): Point | null => {
    const svg = svgRef.current;
    if (svg === null) return null;
    const ctm = svg.getScreenCTM();
    if (ctm === null) return null;
    const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return { x: p.x, y: -p.y };
  }, []);

  const handlePointerDown = useCallback(
    (target: HandleTarget, event: React.PointerEvent) => {
      (event.target as Element).setPointerCapture(event.pointerId);
      select(target.elementId, target.anchorIndex);
      setDragging(target);
    },
    [select],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent) => {
      if (dragging === null) return;
      const spec = doc.elements.find((e) => e.id === dragging.elementId);
      if (spec === undefined) return;
      const world = clientToWorld(event.clientX, event.clientY);
      if (world === null) return;
      const local = toLocal(world, spec.placement);

      const element = resolveElement(spec);
      const anchor = element.anchors[dragging.anchorIndex];
      if (anchor === undefined) return;
      const derived = derivedAt(element, dragging.anchorIndex);

      const patch = patchFor(dragging.kind, anchor, local, derived);
      if (patch === null) return;

      apply(
        (d) => setAnchor(d, dragging.elementId, dragging.anchorIndex, patch),
        `drag:${dragging.elementId}:${dragging.anchorIndex}:${dragging.kind}`,
      );
    },
    [dragging, doc, clientToWorld, apply],
  );

  const stopDragging = useCallback(() => {
    if (dragging === null) return;
    setDragging(null);
    endCoalescing();
  }, [dragging, endCoalescing]);

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      viewBox={`${view.x} ${-(view.y + view.h)} ${view.w} ${view.h}`}
      className="editor-surface"
      role="application"
      aria-label="Profile editor"
      onPointerMove={handlePointerMove}
      onPointerUp={stopDragging}
      onPointerCancel={stopDragging}
      onPointerDown={() => select(null)}
    >
      <g transform="scale(1, -1)">
        {rendered.map((r) => {
          const selected = selection?.elementId === r.id;
          const spec = doc.elements.find((e) => e.id === r.id);
          if (spec === undefined) return null;
          return (
            <g key={r.id}>
              {r.comb.map((tooth, i) => (
                <line
                  key={`comb-${i}`}
                  className={tooth.kappa >= 0 ? "comb positive" : "comb negative"}
                  x1={tooth.base.x}
                  y1={tooth.base.y}
                  x2={tooth.tip.x}
                  y2={tooth.tip.y}
                  strokeWidth={scale * 0.35}
                />
              ))}
              {/*
                A transparent fat stroke under the visible one, so the
                contour can actually be hit. The visible stroke is a
                hairline at any sensible zoom, and a hairline is not a
                click target; without this, selecting a profile by clicking
                it only works by luck.
              */}
              <path
                className="contour-hit"
                d={pathFrom(r.contour)}
                strokeWidth={scale * 10}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  select(r.id, null);
                }}
              />
              <path
                className={selected ? "contour selected" : "contour"}
                d={pathFrom(r.contour)}
                strokeWidth={scale}
              />
              {r.inflections.map((p, i) => (
                <circle
                  key={`inf-${i}`}
                  className="inflection"
                  cx={p.x}
                  cy={p.y}
                  r={scale * 3}
                  strokeWidth={scale * 0.8}
                />
              ))}
              {selected && (
                <AnchorHandles
                  element={r.element}
                  elementId={r.id}
                  placement={spec.placement}
                  selectedAnchor={selection?.anchorIndex ?? null}
                  scale={scale}
                  onPointerDown={handlePointerDown}
                />
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}

/**
 * Turn a pointer position into an anchor patch.
 *
 * Pure, and exported for the tests: this is where a drag becomes the same
 * kind of value a number field produces.
 */
export function patchFor(
  kind: HandleTarget["kind"],
  anchor: Anchor,
  local: Point,
  derived: { position: boolean; phi: boolean; radius: boolean },
): Partial<Anchor> | null {
  const origin = { x: anchor.x, y: anchor.y };
  const offset = vec.sub(local, origin);

  switch (kind) {
    case "anchor": {
      if (derived.position) return null;
      return { x: local.x, y: local.y };
    }
    case "armOut":
    case "armIn": {
      // The incoming arm points backwards along the direction of travel.
      const sign = kind === "armOut" ? 1 : -1;
      const key = kind === "armOut" ? "Lout" : "Lin";
      if (derived.phi) {
        // Only the length is ours to set; project onto the fixed tangent.
        const tangent = vec.fromAngle(anchor.phi);
        const projected = sign * vec.dot(offset, tangent);
        if (projected <= 0) return null;
        return { [key]: projected };
      }
      const len = vec.length(offset);
      if (len <= 0) return null;
      const phi = Math.atan2(sign * offset.y, sign * offset.x);
      return { [key]: len, phi };
    }
    case "radius": {
      if (derived.radius) return null;
      // The centre of curvature is `anchor + normal * R`, so projecting
      // the drag onto the normal recovers R with its sign.
      const normal = vec.curveNormal(vec.fromAngle(anchor.phi));
      const signedDistance = vec.dot(offset, normal);
      if (Math.abs(signedDistance) < 1e-6) return null;
      if (Math.abs(signedDistance) >= RADIUS_HANDLE_CAP) {
        // At the cap the handle stops meaning a position, so it stops
        // changing the value rather than snapping to something arbitrary.
        return null;
      }
      return { R: signedDistance };
    }
    default:
      return null;
  }
}
