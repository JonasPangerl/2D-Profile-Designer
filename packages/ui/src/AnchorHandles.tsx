/**
 * The drag handles for one element.
 *
 * Three kinds, and which of them a given anchor gets depends on which of
 * its fields the element-level parameters own. A handle for a derived field
 * is drawn hollow and is not draggable, with the element panel as the way
 * in; hiding it would be cheaper to build and harder to understand.
 *
 * | Handle | Sets |
 * |---|---|
 * | anchor | `x`, `y` |
 * | arm, incoming and outgoing | `Lin` or `Lout`, and `phi` with it |
 * | radius | `R`, by dragging the centre of curvature |
 */

import { derivedAnchorFields, toWorld, vec } from "@foil/geometry";
import type {
  Anchor,
  DerivedAnchorFields,
  Placement,
  Point,
  ResolvedElement,
} from "@foil/geometry";

/**
 * Furthest the centre-of-curvature handle is drawn from its anchor, in
 * chord units.
 *
 * A nearly straight anchor has its centre of curvature far off screen, so
 * the handle is capped. Beyond the cap it is drawn hollow and is not
 * draggable: a handle whose position does not mean what it looks like is
 * worse than no handle, and the numeric field covers that case.
 */
export const RADIUS_HANDLE_CAP = 0.5;

export type HandleKind = "anchor" | "armIn" | "armOut" | "radius";

export interface HandleTarget {
  readonly elementId: string;
  readonly anchorIndex: number;
  readonly kind: HandleKind;
}

export interface AnchorHandlesProps {
  readonly element: ResolvedElement;
  readonly elementId: string;
  readonly placement: Placement;
  readonly selectedAnchor: number | null;
  readonly scale: number;
  readonly onPointerDown: (target: HandleTarget, event: React.PointerEvent) => void;
}

/**
 * Which anchor fields the element-level parameters own.
 *
 * This asks the geometry core rather than restating the rule. It used to
 * be a third copy of the same decision, alongside `resolveAnchors` and
 * `derivedFields`; the three agreed, and nothing stopped them drifting.
 * The drift would have been silent in the worst direction: a handle that
 * still looks draggable, moves under the cursor, and does nothing.
 *
 * Note it reads the SPEC anchors, not the resolved ones, which is what the
 * geometry side does too.
 */
export function derivedAt(element: ResolvedElement, anchorIndex: number): DerivedAnchorFields {
  return derivedAnchorFields(element.spec.anchors, anchorIndex);
}

/** Where the outgoing arm handle sits, in element-local coordinates. */
export function armOutPoint(anchor: Anchor): Point {
  return vec.addScaled({ x: anchor.x, y: anchor.y }, vec.fromAngle(anchor.phi), anchor.Lout);
}

/** Where the incoming arm handle sits, in element-local coordinates. */
export function armInPoint(anchor: Anchor): Point {
  return vec.addScaled({ x: anchor.x, y: anchor.y }, vec.fromAngle(anchor.phi), -anchor.Lin);
}

/**
 * Where the radius handle sits: the centre of curvature, capped.
 *
 * The centre is `anchor + normal * R` for either sign of `R`, which is why
 * dragging it and projecting onto the normal recovers the sign for free.
 */
export function radiusHandlePoint(anchor: Anchor): { point: Point; capped: boolean } {
  const normal = vec.curveNormal(vec.fromAngle(anchor.phi));
  const capped = !Number.isFinite(anchor.R) || Math.abs(anchor.R) > RADIUS_HANDLE_CAP;
  const distance = capped ? Math.sign(anchor.R || 1) * RADIUS_HANDLE_CAP : anchor.R;
  return {
    point: vec.addScaled({ x: anchor.x, y: anchor.y }, normal, distance),
    capped,
  };
}

export function AnchorHandles({
  element,
  elementId,
  placement,
  selectedAnchor,
  scale,
  onPointerDown,
}: AnchorHandlesProps): JSX.Element {
  const r = scale * 3;

  return (
    <g className="handles">
      {element.anchors.map((anchor, index) => {
        const derived = derivedAt(element, index);
        const selected = selectedAnchor === index;
        const centre = toWorld({ x: anchor.x, y: anchor.y }, placement);

        const grab = (kind: HandleKind) => (event: React.PointerEvent) => {
          event.stopPropagation();
          onPointerDown({ elementId, anchorIndex: index, kind }, event);
        };

        return (
          <g key={index}>
            {selected && (
              <>
                {/* The arm bar, so the two handles read as one control. */}
                <line
                  className="arm-bar"
                  x1={toWorld(armInPoint(anchor), placement).x}
                  y1={toWorld(armInPoint(anchor), placement).y}
                  x2={toWorld(armOutPoint(anchor), placement).x}
                  y2={toWorld(armOutPoint(anchor), placement).y}
                  strokeWidth={scale * 0.7}
                />
                <HandleDot
                  point={toWorld(armInPoint(anchor), placement)}
                  r={r * 0.8}
                  className="handle arm"
                  onPointerDown={grab("armIn")}
                />
                <HandleDot
                  point={toWorld(armOutPoint(anchor), placement)}
                  r={r * 0.8}
                  className="handle arm"
                  onPointerDown={grab("armOut")}
                />
                <RadiusHandle
                  anchor={anchor}
                  placement={placement}
                  centre={centre}
                  r={r * 0.8}
                  scale={scale}
                  derived={derived.radius}
                  onPointerDown={grab("radius")}
                />
              </>
            )}
            <HandleDot
              point={centre}
              r={selected ? r * 1.3 : r}
              className={[
                "handle anchor",
                selected ? "selected" : "",
                derived.position ? "derived" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onPointerDown={grab("anchor")}
            />
          </g>
        );
      })}
    </g>
  );
}

function HandleDot({
  point,
  r,
  className,
  onPointerDown,
}: {
  point: Point;
  r: number;
  className: string;
  onPointerDown: (event: React.PointerEvent) => void;
}): JSX.Element {
  return (
    <circle
      className={className}
      cx={point.x}
      cy={point.y}
      r={r}
      strokeWidth={r * 0.35}
      onPointerDown={onPointerDown}
    />
  );
}

function RadiusHandle({
  anchor,
  placement,
  centre,
  r,
  scale,
  derived,
  onPointerDown,
}: {
  anchor: Anchor;
  placement: Placement;
  centre: Point;
  r: number;
  scale: number;
  derived: boolean;
  onPointerDown: (event: React.PointerEvent) => void;
}): JSX.Element {
  const { point, capped } = radiusHandlePoint(anchor);
  const world = toWorld(point, placement);
  return (
    <>
      <line
        className="radius-bar"
        x1={centre.x}
        y1={centre.y}
        x2={world.x}
        y2={world.y}
        strokeWidth={scale * 0.5}
      />
      <circle
        className={["handle radius", capped || derived ? "derived" : ""].filter(Boolean).join(" ")}
        cx={world.x}
        cy={world.y}
        r={r}
        strokeWidth={r * 0.35}
        onPointerDown={capped || derived ? undefined : onPointerDown}
      />
    </>
  );
}
