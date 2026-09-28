import {
  BARREL_BOTTOM,
  BARREL_LEFT,
  BARREL_RIGHT,
  BARREL_TOP,
  CENTER_X,
  SCALE_LENGTH,
  SCALE_TOP,
  STOPPER_HEIGHT,
  THUMB_TOP,
  VIEW_HEIGHT,
  VIEW_WIDTH,
  describeSyringe,
  scaleMarks,
  syringePosition,
  type SyringeView,
} from "@/lib/syringe";

const INNER_LEFT = BARREL_LEFT + 1.5;
const INNER_WIDTH = BARREL_RIGHT - BARREL_LEFT - 3;
const SCALE_BOTTOM = SCALE_TOP + SCALE_LENGTH;

// The upright syringe. Keyed by size, so it only rebuilds when the syringe changes;
// otherwise the fill and plunger slide to the new dose.
export function SyringeDiagram({ syringe, units, state }: SyringeView) {
  const position = syringePosition({ syringe, units, state });
  const moving = { transform: `translateY(${position.offset}px)` };
  return (
    <figure className="grid grid-cols-[7rem_minmax(0,1fr)] items-end gap-4 sm:block">
      <svg
        key={syringe}
        className="syr block h-auto max-h-[640px] w-full"
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        preserveAspectRatio="xMidYMin meet"
        role="img"
        aria-label={describeSyringe({ syringe, units, state })}
        data-syringe={syringe}
        data-state={state}
      >
        <line className="syr-needle" x1={CENTER_X} y1={6} x2={CENTER_X} y2={60} />
        <rect
          className="syr-hub"
          x={CENTER_X - 7}
          y={58}
          width={14}
          height={BARREL_TOP - 58}
          rx={2}
        />
        <rect
          className="syr-barrel"
          x={BARREL_LEFT}
          y={BARREL_TOP}
          width={BARREL_RIGHT - BARREL_LEFT}
          height={BARREL_BOTTOM - BARREL_TOP}
          rx={3}
        />
        {/* The rod runs the full length behind the liquid; the opaque fill hides the part above the stopper. */}
        <rect
          className="syr-rod"
          x={CENTER_X - 3}
          y={SCALE_TOP}
          width={6}
          height={THUMB_TOP - SCALE_TOP}
        />
        <rect
          className="syr-fill"
          x={INNER_LEFT}
          y={SCALE_TOP}
          width={INNER_WIDTH}
          height={SCALE_LENGTH}
          style={{ transform: `scaleY(${position.fillScale})` }}
        />
        <g className="syr-moving" style={moving}>
          <rect
            className="syr-stopper"
            x={INNER_LEFT}
            y={SCALE_TOP}
            width={INNER_WIDTH}
            height={STOPPER_HEIGHT}
            rx={2}
          />
        </g>
        {scaleMarks(syringe).map((mark) => (
          <g key={mark.units}>
            <line
              className={mark.major ? "syr-tick syr-tick-major" : "syr-tick"}
              x1={BARREL_RIGHT - (mark.major ? 16 : 8)}
              y1={mark.y}
              x2={BARREL_RIGHT}
              y2={mark.y}
            />
            {mark.major && (
              <text className="syr-label" x={BARREL_RIGHT + 6} y={mark.y} dy="0.35em">
                {mark.units}
              </text>
            )}
          </g>
        ))}
        <line
          className="syr-overflow"
          x1={BARREL_LEFT - 6}
          y1={SCALE_BOTTOM}
          x2={BARREL_RIGHT}
          y2={SCALE_BOTTOM}
        />
        <g className="syr-moving syr-draw" style={moving}>
          <line
            className="syr-drawline"
            x1={BARREL_LEFT - 6}
            y1={SCALE_TOP}
            x2={BARREL_RIGHT}
            y2={SCALE_TOP}
          />
          <text className="syr-drawlabel" x={BARREL_LEFT - 10} y={SCALE_TOP} dy="0.35em">
            {position.label}
          </text>
        </g>
        <rect
          className="syr-flange"
          x={BARREL_LEFT - 14}
          y={BARREL_BOTTOM}
          width={BARREL_RIGHT - BARREL_LEFT + 28}
          height={8}
          rx={2}
        />
        <rect className="syr-thumb" x={CENTER_X - 16} y={THUMB_TOP} width={32} height={8} rx={2} />
      </svg>
      <figcaption className="text-sm text-muted-foreground sm:mt-2">
        Read at the top edge of the rubber stopper.
      </figcaption>
    </figure>
  );
}
