/**
 * A read-only SVG view of a document.
 *
 * This is deliberately not the editor. It is the harness that makes the
 * geometry core visible, and it is the idiom M2 extends: one `<svg>`, one
 * path per element, control points and comb drawn as plain elements so that
 * hit testing for dragging comes for free later.
 */

import { useMemo } from "react";
import {
  buildComb,
  contourToWorld,
  findInflections,
  resolveElement,
  sampleElement,
} from "@foil/geometry";
import type { CombTooth, Point, ProfileDocument } from "@foil/geometry";

export interface ProfileViewProps {
  readonly doc: ProfileDocument;
  /** Points sampled per element. */
  readonly sampleCount?: number;
  /** Comb zoom. 0 hides the comb. */
  readonly combGain?: number;
  readonly showControlPoints?: boolean;
  readonly width?: number;
  readonly height?: number;
}

interface ElementRender {
  readonly id: string;
  readonly contour: readonly Point[];
  readonly comb: readonly CombTooth[];
  readonly controlPoints: readonly Point[];
  readonly inflections: readonly Point[];
}

function pathFrom(points: readonly Point[]): string {
  if (points.length === 0) return "";
  const head = points[0] as Point;
  const rest = points
    .slice(1)
    .map((p) => `L ${p.x.toFixed(6)} ${p.y.toFixed(6)}`)
    .join(" ");
  // The contour is closed with a straight base line across the blunt
  // trailing edge, which is what the two trailing edge anchors describe.
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
  const pad = 0.08 * Math.max(maxX - minX, maxY - minY, 1e-6);
  return {
    x: minX - pad,
    y: minY - pad,
    w: maxX - minX + 2 * pad,
    h: maxY - minY + 2 * pad,
  };
}

export function ProfileView({
  doc,
  sampleCount = 200,
  combGain = 0.06,
  showControlPoints = true,
  width = 960,
  height = 420,
}: ProfileViewProps): JSX.Element {
  const rendered = useMemo<ElementRender[]>(
    () =>
      doc.elements.map((spec) => {
        const element = resolveElement(spec);
        const samples = sampleElement(element, { count: sampleCount });
        const contour = contourToWorld(
          samples.map((s) => s.point),
          spec.placement,
        );
        const comb =
          combGain > 0
            ? buildComb(samples, { gain: combGain }).map((tooth) => ({
                base: contourToWorld([tooth.base], spec.placement)[0] as Point,
                tip: contourToWorld([tooth.tip], spec.placement)[0] as Point,
                kappa: tooth.kappa,
              }))
            : [];
        const controlPoints = showControlPoints
          ? contourToWorld(
              element.segments.flatMap((s) => [...s.points]),
              spec.placement,
            )
          : [];
        const inflections = contourToWorld(
          findInflections(samples, element.leIndex)
            .filter((m) => m.onSuctionSide)
            .map((m) => m.point),
          spec.placement,
        );
        return { id: spec.id, contour, comb, controlPoints, inflections };
      }),
    [doc, sampleCount, combGain, showControlPoints],
  );

  const view = boundsOf(rendered.flatMap((r) => [...r.contour, ...r.comb.map((t) => t.tip)]));
  const stroke = Math.max(view.w, view.h) / 500;

  return (
    <svg
      width={width}
      height={height}
      // The y axis points up in aerodynamics and down in SVG, so the whole
      // scene is flipped once here rather than in every coordinate.
      viewBox={`${view.x} ${-(view.y + view.h)} ${view.w} ${view.h}`}
      role="img"
      aria-label="Profile geometry"
    >
      <g transform="scale(1, -1)">
        {rendered.map((r) => (
          <g key={r.id}>
            {r.comb.map((tooth, i) => (
              <line
                key={`comb-${i}`}
                x1={tooth.base.x}
                y1={tooth.base.y}
                x2={tooth.tip.x}
                y2={tooth.tip.y}
                stroke={tooth.kappa >= 0 ? "#6aa9ff" : "#ff8f5a"}
                strokeWidth={stroke * 0.4}
              />
            ))}
            <path d={pathFrom(r.contour)} fill="none" stroke="#111" strokeWidth={stroke} />
            {r.controlPoints.map((p, i) => (
              <circle key={`cp-${i}`} cx={p.x} cy={p.y} r={stroke * 1.6} fill="#c0c6d0" />
            ))}
            {r.inflections.map((p, i) => (
              <circle
                key={`inf-${i}`}
                cx={p.x}
                cy={p.y}
                r={stroke * 3}
                fill="none"
                stroke="#d93025"
                strokeWidth={stroke * 0.8}
              />
            ))}
          </g>
        ))}
      </g>
    </svg>
  );
}
