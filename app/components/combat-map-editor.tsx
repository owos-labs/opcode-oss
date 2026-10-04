"use client";

import { Button } from "@heroui/react";
import { Modal } from "@heroui/react/modal";
import {
  AlertTriangle,
  BoxSelect,
  CheckCircle2,
  DoorOpen,
  Download,
  Grid3x3,
  Hand,
  Pencil,
  Play,
  Save,
  Shield,
  RotateCw,
  Square,
  Upload,
  UserPlus,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";

import { Card } from "@/app/components/card";
import { CombatMapPlayOverlays } from "@/app/components/combat-map-bench-overlays";
import { useCombatEditorMap, useCombatEditorMeta, useCombatList } from "@/app/components/combat-app";
import { CombatMapImportInput } from "@/app/components/combat-map-import-input";
import { useSheetApp } from "@/app/components/sheet-app";
import { ColorField, download, Field, Kbd, SelectField, TextField } from "@/app/components/ui";
import {
  NPC_DIFFICULTY_IDS,
  type NpcDifficultyId,
} from "@/lib/combat-ai/difficulty";
import {
  boundingBoxElement,
  canDeleteCombatMapElement,
  COMBAT_MAP_DEFAULT_BOUNDS_FILL,
  COMBAT_MAP_DEFAULT_BOUNDS_STROKE,
  insertCombatMapRect,
  insertNpcToken,
  mapBackgroundColor,
  moveCombatMapElement,
  newCombatMapElementId,
  nextElementDisplayName,
  parseCombatMapElements,
  parsePathD,
  pruneCombatMapLayerGroups,
  removeCombatMapElement,
  removeCombatMapLayerFromGroups,
  type CombatMapDocument,
  type CombatMapElement,
  updateCombatMapElement,
  updateCombatMapPathVertex,
  type InsertRectOptions,
} from "@/lib/combat/combat-map-document";
import { coverHeightSelectOptions, normalizeCoverHeightFraction } from "@/lib/combat/cover-height-options";
import {
  coverPresetAttrs,
  coverPresetSelectOptions,
  coverPresetsForKind,
  findMatchingCoverPreset,
} from "@/lib/combat/combat-map-cover-presets";
import {
  npcTokenDiameterMFromAttrs,
  patchNpcTokenRadiusFromDiameterM,
  resolvePlayModeTapSelection,
} from "@/lib/combat/combat-map-npc-token";
import { combatMapElementBounds, combatMapElementCenter } from "@/lib/combat/combat-map-element-geometry";
import { combatMapNpcPlacements } from "@/lib/combat/combat-map-npc-placements";
import {
  buildCombatMapPlayOverlay,
  DEFAULT_COMBAT_MAP_PLAY_OVERLAY_TOGGLES,
  type CombatMapPlayOverlayToggles,
} from "@/lib/combat/combat-map-play-overlay";
import type { CompiledCombatMap } from "@/lib/combat/map-adapter/compile";
import {
  closestCombatMapSelectableShape,
  combatMapElementIdAfterUpdate,
  combatMapElementIdFromDom,
  combatMapNpcTokenIdFromDom,
  COMBAT_MAP_SELECTABLE_SHAPE_SELECTOR,
  ensureCombatMapElementIds,
} from "@/lib/combat/combat-map-element-id";
import {
  createLayerGroupFromSelection,
  ungroupSelectedLayers,
} from "@/lib/combat/combat-map-layer-groups";
import {
  COMBAT_MAP_SHARED_MIXED,
  displaySharedAttr,
  sharedAttrPlaceholder,
  sharedBarrierSelection,
  sharedConcealmentSelection,
  sharedElementAttr,
  sharedRoomSelection,
  sharedWallLikeKeys,
} from "@/lib/combat/combat-map-selection-props";
import {
  copyCombatMapElementFromSvg,
  pasteCombatMapElement,
} from "@/lib/combat/combat-map-clipboard";
import {
  collectCombatMapSnapTargets,
  meterGridSnapFromArtboard,
  snapDrawRectFromAnchor,
  snapMoveDelta,
  snapPoint,
  snapThresholdMapUnits,
  type MeterGridSnap,
  type SnapGuide,
} from "@/lib/combat/combat-map-snap";
import {
  combatDrawToolActive,
  gridSnapEnabledForElementKind,
  isCombatDrawRectLargeEnough,
  isCombatDrawTool,
  isCombatMapClipboardKeyDown,
  isCombatMapEscapeKeyDown,
  isCombatMapGroupKeyDown,
  isCombatMapHelpKeyDown,
  isCombatMapTypingTarget,
  isCombatMapUngroupKeyDown,
  isCombatMapUndoKeyDown,
  isMarqueeSelectModifier,
  isSpacePanKeyDown,
  minCombatDrawRectSizeSvg,
} from "@/lib/combat/combat-map-editor-input";
import { formatCombatMapComplianceIssue } from "@/lib/combat/combat-map-compliance-format";
import { combatMapComplianceReport } from "@/lib/combat/combat-map-compliance";
import { COMBAT_MAP_EDITOR_HELP_ENTRIES } from "@/lib/combat/combat-map-editor-help";
import {
  exportCombatMapFilename,
  serializeCombatMapExport,
  type CombatMapImportResult,
} from "@/lib/combat/combat-map-import-export";
import {
  createCombatMapHistory,
  pushCombatMapHistory,
  redoCombatMapHistory,
  undoCombatMapHistory,
} from "@/lib/combat/combat-map-history";
import {
  boundsFromHandleDrag,
  resizeCombatMapElement,
  resizeCombatMapRectIgnoringRotation,
  scaleHandlePositions,
  scaleHandleScreenCursor,
  scaleHandleScreenRect,
  SCALE_HANDLE_IDS,
  type ScaleHandleId,
} from "@/lib/combat/combat-map-scale";
import {
  previewMapPath,
  previewMapRect,
  previewMapStyle,
  rectPatchFromAttrs,
} from "@/lib/combat/combat-map-canvas-preview";
import {
  pickGroupCornerInteraction,
  pointInBounds,
  resizeCombatMapSelection,
  rotateCombatMapSelection,
  selectionGroupBounds,
  transformableSelectionIds,
} from "@/lib/combat/combat-map-group-transform";
import {
  patchRectRotation,
  pickRectCornerInteraction,
  pointerAngleDeg,
  rectElementIsRotated,
  rectElementRotation,
  rectLocalBounds,
  rectRotationCenter,
  rotationDragDegrees,
  selectionOutlineCorners,
  updateCombatMapElementRotation,
} from "@/lib/combat/combat-map-rotate";
import {
  centerPanOnSvgPoint,
  combatMapArtboardRect,
  combatMapBoundsToScreenRect,
  combatMapSnapGuideScreenSegment,
  combatMapScreenHandleRect,
  COMBAT_MAP_EDIT_UI_INSETS,
  COMBAT_MAP_HANDLE_SCREEN_PX,
  COMBAT_MAP_PLAY_UI_INSETS,
  COMBAT_MAP_SCREEN_STROKE_PX,
  COMBAT_MAP_VIEWPORT_RULER_LEFT_W,
  COMBAT_MAP_VIEWPORT_RULER_TOP_H,
  fitCombatMapArtboard,
  formatCombatMapZoomPercent,
  mapDeltaFromClientDrag,
  mapPointFromClientDrag,
  mapSvgToScreen,
  svgPointAtClient as clientToMapPoint,
  visibleMapSvgRect,
} from "@/lib/combat/combat-map-viewport";
import { parseSvgViewBox } from "@/lib/combat/combat-test-scene";
import { combatMapBoundsStroke, combatMapEditorChrome } from "@/lib/combat/combat-map-chrome";
import {
  collectConcealmentCoverLabels,
  COMBAT_MAP_COVER_LABEL_PAD_SCREEN_PX,
  COMBAT_MAP_COVER_LABEL_SCREEN_PX,
  combatMapOverlayCenterFontSize,
  combatMapOverlayLabelText,
  concealmentCoverLabelTransform,
  shouldShowConcealmentCoverLabels,
} from "@/lib/combat/combat-map-cover-labels";
import {
  collectRoomLabels,
  shouldShowRoomLabels,
  roomLabelTransform,
} from "@/lib/combat/combat-map-room-labels";
import { collectCombatMapWallStrokes } from "@/lib/combat/combat-map-wall-chrome";
import {
  applyCombatMapOobInsideClip,
  COMBAT_MAP_OOB_DIM_OPACITY,
  COMBAT_MAP_OOB_OUTSIDE_CLIP_ID,
  combatMapOobGhostShape,
  combatMapOutsideArtboardClipPathD,
  elementOutsideArtboard,
  hitOutOfBoundsElementAtPoint,
  oobHoverLabelAnchor,
} from "@/lib/combat/combat-map-oob";
import { prepareCombatMapSvgForDisplay } from "@/lib/combat/combat-map-svg-display";
import {
  buildCombatMapGridLinesInRange,
  clipCombatMapGridLineSegment,
  pickCombatMapGridStepMeters,
  buildCombatMapRulerMarksInRange,
  pickRulerTickStepMeters,
  type RulerMark,
} from "@/lib/combat/combat-map-ruler";
import {
  combatMapMetersPerUnit,
  ensureCombatMapMetersPerUnit,
  meterFieldToSvgLength,
  svgLengthToMeterField,
} from "@/lib/combat/combat-map-units";
import type { ArtboardRect } from "@/lib/combat/combat-map-viewport";
import { sheetHasRangedWeapon } from "@/lib/combat/sheet-has-ranged-weapon";
import { readOpcodeInventory } from "@/lib/character-sheets/opcodeInventory";
import { readOpcodeSheetSummary } from "@/lib/character-sheets/opcodeSheet";
import { sheetListLabel } from "@/lib/character-sheets/model";
import { useT } from "@/lib/character-sheets/i18n";
import { selectPrimaryRangedWeapon } from "@/lib/combat/character-sheet-snapshot";
import {
  moveCombatMapSelection,
  primarySelectionId,
  boundsFromTwoPoints,
  selectIdsForPointerDown,
  selectIdsInMarquee,
} from "@/lib/combat/combat-map-selection";

export type CombatEditorTool =
  | "select"
  | "npc"
  | "concealment"
  | "barrier"
  | "room"
  | "bounding_box";

const MAX_SCALE = 64;

function elementLabel(el: CombatMapElement, t: (key: string) => string): string {
  if (el.kind === "npc_token") return el.attrs["sheet-id"] ? t("combat.editor.layer.npc") : el.id;
  if (el.kind === "bounding_box") return t("combat.editor.layer.bounds");
  if (el.kind === "barrier") return el.attrs.name || t("combat.editor.layer.wall");
  if (el.kind === "concealment") return el.attrs.name || t("combat.editor.layer.cover");
  if (el.kind === "room") return el.attrs.name || t("combat.editor.layer.room");
  return el.id;
}

const COMBAT_MAP_EDITOR_ARTBOARD_CLIP_ID = "combat-map-editor-artboard-clip";

function CombatMapOobOverlay({
  elements,
  artboard,
  scale,
  hoverElementId,
  label,
}: {
  elements: CombatMapElement[];
  artboard: { x: number; y: number; w: number; h: number };
  scale: number;
  hoverElementId: string | null;
  label: string;
}) {
  const oobElements = useMemo(
    () => elements.filter((el) => elementOutsideArtboard(el, artboard)),
    [elements, artboard],
  );
  if (oobElements.length === 0) return null;

  const hoverEl = hoverElementId ? oobElements.find((el) => el.id === hoverElementId) : null;
  const hoverAnchor = hoverEl ? oobHoverLabelAnchor(hoverEl, artboard) : null;
  const fontSize = COMBAT_MAP_COVER_LABEL_SCREEN_PX / Math.max(scale, 1e-9);

  return (
    <g className="combat-map-oob-overlay" pointerEvents="none">
      <defs>
        <clipPath id={COMBAT_MAP_OOB_OUTSIDE_CLIP_ID} clipPathUnits="userSpaceOnUse">
          <path fillRule="evenodd" d={combatMapOutsideArtboardClipPathD(artboard)} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${COMBAT_MAP_OOB_OUTSIDE_CLIP_ID})`} opacity={COMBAT_MAP_OOB_DIM_OPACITY}>
        {oobElements.map((el) => {
          const shape = combatMapOobGhostShape(el);
          if (!shape) return null;
          if (shape.tag === "rect") {
            return (
              <rect
                key={`oob-${el.id}`}
                x={shape.x}
                y={shape.y}
                width={shape.width}
                height={shape.height}
                fill={shape.fill}
                fillOpacity={shape.fillOpacity}
                stroke={shape.stroke}
                strokeWidth={shape.strokeWidth}
                transform={shape.transform}
              />
            );
          }
          if (shape.tag === "circle") {
            return (
              <circle
                key={`oob-${el.id}`}
                cx={shape.cx}
                cy={shape.cy}
                r={shape.r}
                fill={shape.fill}
                stroke={shape.stroke}
                strokeWidth={shape.strokeWidth}
              />
            );
          }
          return (
            <path
              key={`oob-${el.id}`}
              d={shape.d}
              fill={shape.fill}
              stroke={shape.stroke}
              strokeWidth={shape.strokeWidth}
            />
          );
        })}
      </g>
      {hoverAnchor ? (
        <text
          x={hoverAnchor.x}
          y={hoverAnchor.y}
          textAnchor="middle"
          dominantBaseline="middle"
          className="combat-map-svg-text combat-map-overlay-label-text"
          fontSize={fontSize}
          fontWeight={900}
          fill="#dc2626"
        >
          {label}
        </text>
      ) : null}
    </g>
  );
}

function CombatMapWallStrokeOverlay({
  elements,
  scale,
}: {
  elements: ReturnType<typeof parseCombatMapElements>;
  scale: number;
}) {
  const strokes = useMemo(() => collectCombatMapWallStrokes(elements), [elements]);
  const strokeWidth = COMBAT_MAP_SCREEN_STROKE_PX / Math.max(scale, 1e-9);
  if (strokes.length === 0) return null;

  return (
    <g className="combat-map-wall-strokes" pointerEvents="none">
      {strokes.map((item) =>
        item.tag === "rect" ? (
          <rect
            key={`wall-stroke-${item.id}`}
            data-wall-stroke-id={item.id}
            x={item.x}
            y={item.y}
            width={item.width}
            height={item.height}
            transform={item.transform}
            fill="none"
            stroke={item.stroke}
            strokeWidth={strokeWidth}
          />
        ) : (
          <path
            key={`wall-stroke-${item.id}`}
            data-wall-stroke-id={item.id}
            d={item.d}
            fill="none"
            stroke={item.stroke}
            strokeWidth={strokeWidth}
          />
        ),
      )}
    </g>
  );
}

function CombatMapRoomLabelOverlay({
  elements,
  scale,
  metersPerUnit,
}: {
  elements: ReturnType<typeof parseCombatMapElements>;
  scale: number;
  metersPerUnit: number;
}) {
  const labels = useMemo(
    () => collectRoomLabels(elements, metersPerUnit),
    [elements, metersPerUnit],
  );
  if (!shouldShowRoomLabels(scale) || labels.length === 0) return null;

  const fontSize = COMBAT_MAP_COVER_LABEL_SCREEN_PX / Math.max(scale, 1e-9);
  const pad = COMBAT_MAP_COVER_LABEL_PAD_SCREEN_PX / Math.max(scale, 1e-9);
  const textProps = {
    className: "combat-map-svg-text combat-map-overlay-label-text",
    fontSize,
    fontWeight: 900,
    fill: "#000000",
  };

  return (
    <g className="combat-map-room-labels" pointerEvents="none">
      {labels.map((label) => {
        const { x, y, width: w, height: h } = label.localBounds;
        const cx = x + w / 2;
        const cy = y + h / 2;
        const displayName = combatMapOverlayLabelText(label.name);
        const displaySize = combatMapOverlayLabelText(label.sizeLabel);
        const centerFontSize = combatMapOverlayCenterFontSize(label.localBounds, scale, displaySize);
        return (
          <g key={`room-label-${label.id}`} transform={roomLabelTransform(label)}>
            <text
              x={cx}
              y={cy}
              textAnchor="middle"
              dominantBaseline="middle"
              {...textProps}
              fontSize={centerFontSize}
            >
              {displaySize}
            </text>
            <text x={x + w - pad} y={y + h - pad} textAnchor="end" dominantBaseline="auto" {...textProps}>
              {displayName}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function CombatMapConcealmentLabelOverlay({
  elements,
  scale,
  metersPerUnit,
}: {
  elements: ReturnType<typeof parseCombatMapElements>;
  scale: number;
  metersPerUnit: number;
}) {
  const labels = useMemo(
    () => collectConcealmentCoverLabels(elements, metersPerUnit),
    [elements, metersPerUnit],
  );
  if (!shouldShowConcealmentCoverLabels(scale) || labels.length === 0) return null;

  const fontSize = COMBAT_MAP_COVER_LABEL_SCREEN_PX / Math.max(scale, 1e-9);
  const pad = COMBAT_MAP_COVER_LABEL_PAD_SCREEN_PX / Math.max(scale, 1e-9);
  const textProps = {
    className: "combat-map-svg-text combat-map-overlay-label-text",
    fontSize,
    fontWeight: 900,
    fill: "#000000",
  };

  return (
    <g className="combat-map-cover-labels" pointerEvents="none">
      {labels.map((label) => {
        const { x, y, width: w, height: h } = label.localBounds;
        const cx = x + w / 2;
        const cy = y + h / 2;
        const displayName = combatMapOverlayLabelText(label.name);
        const displaySize = combatMapOverlayLabelText(label.sizeLabel);
        const centerFontSize = combatMapOverlayCenterFontSize(label.localBounds, scale, displaySize);
        return (
          <g key={`cover-label-${label.id}`} transform={concealmentCoverLabelTransform(label)}>
            <text x={x + w - pad} y={y + pad} textAnchor="end" dominantBaseline="hanging" {...textProps}>
              {combatMapOverlayLabelText(label.ssp)}
            </text>
            <text x={x + pad} y={y + h - pad} textAnchor="start" dominantBaseline="auto" {...textProps}>
              {combatMapOverlayLabelText(label.ar)}
            </text>
            <text x={x + w - pad} y={y + h - pad} textAnchor="end" dominantBaseline="auto" {...textProps}>
              {displayName}
            </text>
            <text
              x={cx}
              y={cy}
              textAnchor="middle"
              dominantBaseline="middle"
              {...textProps}
              fontSize={centerFontSize}
            >
              {displaySize}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function CombatMapGridOverlay({
  viewportSize,
  viewBox,
  pan,
  scale,
  artboard,
  metersPerUnit,
  chrome,
}: {
  viewportSize: { width: number; height: number };
  viewBox: { x: number; y: number; w: number; h: number };
  pan: { x: number; y: number };
  scale: number;
  artboard: ArtboardRect;
  metersPerUnit: number;
  chrome: ReturnType<typeof combatMapEditorChrome>;
}) {
  const range = visibleMapSvgRect(viewBox, pan, scale, viewportSize);
  const stepM = pickCombatMapGridStepMeters(scale, metersPerUnit);
  const lines = buildCombatMapGridLinesInRange(artboard, metersPerUnit, range, stepM);
  const stroke = COMBAT_MAP_SCREEN_STROKE_PX / Math.max(scale, 1e-9);

  return (
    <g className="combat-map-grid" pointerEvents="none">
      {lines.map((line, index) => {
        const segment = clipCombatMapGridLineSegment(line, artboard, range);
        if (!segment) return null;
        return (
          <line
            key={`grid-${line.axis}-${line.svg}-${index}`}
            x1={segment.x1}
            y1={segment.y1}
            x2={segment.x2}
            y2={segment.y2}
            stroke={line.major ? chrome.gridMajor : chrome.gridMinor}
            strokeWidth={stroke}
          />
        );
      })}
    </g>
  );
}

type SelectionOutline =
  | { id: string; kind: "rect"; bounds: { x: number; y: number; width: number; height: number } }
  | { id: string; kind: "polygon"; corners: { x: number; y: number }[] };

function CombatMapScreenOverlay({
  overlayRef,
  viewportSize,
  viewBox,
  pan,
  scale,
  artboard,
  boundsStroke,
  selectionOutlines,
  drawPreview,
  marqueePreview,
  scaleHandles,
  pathVertices,
  snapGuides,
  selectedId,
}: {
  overlayRef?: RefObject<SVGSVGElement | null>;
  viewportSize: { width: number; height: number };
  viewBox: { x: number; y: number; w: number; h: number };
  pan: { x: number; y: number };
  scale: number;
  artboard: ArtboardRect | null;
  boundsStroke: string | null;
  selectionOutlines: SelectionOutline[];
  drawPreview: { x: number; y: number; width: number; height: number } | null;
  marqueePreview: { x: number; y: number; width: number; height: number } | null;
  scaleHandles: Record<ScaleHandleId, { x: number; y: number }> | null;
  pathVertices: { x: number; y: number }[];
  snapGuides: SnapGuide[];
  selectedId: string | null;
}) {
  const showBounds = artboard && boundsStroke && artboard.w > 0 && artboard.h > 0;
  const showDrawPreview = drawPreview && drawPreview.width > 0 && drawPreview.height > 0;
  const showMarqueePreview = !!marqueePreview;
  const showHandles = scaleHandles && selectedId;
  if (
    !showBounds &&
    selectionOutlines.length === 0 &&
    !showDrawPreview &&
    !showMarqueePreview &&
    !showHandles &&
    pathVertices.length === 0 &&
    snapGuides.length === 0
  ) {
    return null;
  }

  const stroke = COMBAT_MAP_SCREEN_STROKE_PX;
  const handleStroke = COMBAT_MAP_SCREEN_STROKE_PX;

  return (
    <svg
      ref={overlayRef}
      className="pointer-events-none absolute inset-0 z-[3]"
      width={viewportSize.width}
      height={viewportSize.height}
      shapeRendering="crispEdges"
      aria-hidden
    >
      {showBounds ? (
        <rect
          {...combatMapBoundsToScreenRect(
            { x: artboard.x, y: artboard.y, width: artboard.w, height: artboard.h },
            viewBox,
            pan,
            scale,
          )}
          fill="none"
          stroke={boundsStroke}
          strokeWidth={stroke}
          pointerEvents="none"
        />
      ) : null}
      {showDrawPreview ? (
        <rect
          {...combatMapBoundsToScreenRect(drawPreview, viewBox, pan, scale)}
          fill="rgba(249,115,22,0.12)"
          stroke="#f97316"
          strokeWidth={stroke}
          strokeDasharray="4 3"
        />
      ) : null}
      {showMarqueePreview && marqueePreview ? (
        <rect
          {...combatMapBoundsToScreenRect(marqueePreview, viewBox, pan, scale)}
          fill="rgba(6,182,212,0.12)"
          stroke="#06b6d4"
          strokeWidth={stroke}
          strokeDasharray="4 3"
        />
      ) : null}
      {selectionOutlines.map((outline) => {
        if (outline.kind === "polygon") {
          const points = outline.corners
            .map((corner) => {
              const screen = mapSvgToScreen(corner.x, corner.y, viewBox, pan, scale);
              return `${screen.x},${screen.y}`;
            })
            .join(" ");
          return (
            <polygon
              key={`sel-screen-${outline.id}`}
              data-selection-outline={outline.id}
              points={points}
              fill="none"
              stroke="#f97316"
              strokeWidth={stroke}
              strokeDasharray="4 3"
            />
          );
        }
        const screen = combatMapBoundsToScreenRect(outline.bounds, viewBox, pan, scale);
        return (
          <rect
            key={`sel-screen-${outline.id}`}
            data-selection-outline={outline.id}
            x={screen.x}
            y={screen.y}
            width={screen.width}
            height={screen.height}
            fill="none"
            stroke="#f97316"
            strokeWidth={stroke}
            strokeDasharray="4 3"
          />
        );
      })}
      {showHandles
        ? SCALE_HANDLE_IDS.map((handleId) => {
            const pt = scaleHandles[handleId];
            const rect = scaleHandleScreenRect(pt.x, pt.y, handleId, scaleHandles, viewBox, pan, scale);
            return (
              <rect
                key={`${selectedId}-${handleId}`}
                data-scale-handle={handleId}
                x={rect.x}
                y={rect.y}
                width={rect.width}
                height={rect.height}
                fill="#ffffff"
                stroke="#f97316"
                strokeWidth={handleStroke}
                className="pointer-events-auto"
                style={{ cursor: scaleHandleScreenCursor(scaleHandles, handleId, viewBox, pan, scale) }}
              />
            );
          })
        : null}
      {pathVertices.map((pt, index) => {
        const rect = combatMapScreenHandleRect(pt.x, pt.y, viewBox, pan, scale);
        return (
          <rect
            key={`${selectedId}-vertex-${index}`}
            data-vertex-handle=""
            data-vertex-index={index}
            x={rect.x}
            y={rect.y}
            width={rect.width}
            height={rect.height}
            rx={COMBAT_MAP_HANDLE_SCREEN_PX / 2}
            fill="#ffffff"
            stroke="#f97316"
            strokeWidth={handleStroke}
            className="pointer-events-auto cursor-grab"
          />
        );
      })}
      {snapGuides.map((guide, index) => {
        const segment = combatMapSnapGuideScreenSegment(guide, viewBox, pan, scale, viewportSize);
        return (
          <line
            key={`snap-${guide.axis}-${guide.value}-${index}`}
            x1={segment.x1}
            y1={segment.y1}
            x2={segment.x2}
            y2={segment.y2}
            stroke="#06b6d4"
            strokeWidth={stroke}
            strokeDasharray="4 3"
            pointerEvents="none"
          />
        );
      })}
    </svg>
  );
}

function CombatMapViewportRulers({
  viewportSize,
  viewBox,
  pan,
  scale,
  marks,
  chrome,
}: {
  viewportSize: { width: number; height: number };
  viewBox: { x: number; y: number; w: number; h: number };
  pan: { x: number; y: number };
  scale: number;
  marks: RulerMark[];
  chrome: ReturnType<typeof combatMapEditorChrome>;
}) {
  const topH = COMBAT_MAP_VIEWPORT_RULER_TOP_H;
  const leftW = COMBAT_MAP_VIEWPORT_RULER_LEFT_W;
  const band = "bg-content1/95";
  const frameStroke = chrome.rulerLine;
  const stroke = COMBAT_MAP_SCREEN_STROKE_PX;

  return (
    <div className="combat-map-viewport-rulers pointer-events-none absolute inset-0 z-[2]">
      <svg
        className="pointer-events-none absolute inset-0"
        width={viewportSize.width}
        height={viewportSize.height}
        shapeRendering="crispEdges"
        aria-hidden
      >
        <line x1={leftW} y1={0} x2={leftW} y2={viewportSize.height} stroke={frameStroke} strokeWidth={stroke} />
        <line x1={0} y1={topH} x2={viewportSize.width} y2={topH} stroke={frameStroke} strokeWidth={stroke} />
      </svg>
      <div className={`absolute left-0 top-0 ${band}`} style={{ width: leftW, height: topH }} />
      <div className={`absolute right-0 top-0 ${band}`} style={{ left: leftW, height: topH }}>
        <svg width={Math.max(viewportSize.width - leftW, 0)} height={topH} aria-hidden>
          {marks
            .filter((mark) => mark.axis === "x")
            .map((mark, index) => {
              const screen = mapSvgToScreen(mark.svg, viewBox.y, viewBox, pan, scale);
              const x = screen.x - leftW;
              if (x < 0 || x > viewportSize.width - leftW) return null;
              const tick = mark.major ? 8 : 5;
              return (
                <g key={`ruler-top-${mark.svg}-${index}`}>
                  <line
                    x1={x}
                    y1={topH - tick}
                    x2={x}
                    y2={topH}
                    stroke={chrome.rulerLine}
                    strokeWidth={1}
                  />
                  {mark.label ? (
                    <text
                      x={x}
                      y={topH - tick - 3}
                      fontSize={10}
                      textAnchor="middle"
                      dominantBaseline="auto"
                      fill={chrome.rulerText}
                      stroke={chrome.rulerTextStroke}
                      strokeWidth={2}
                      paintOrder="stroke fill"
                      className="combat-map-svg-text"
                    >
                      {mark.label}
                    </text>
                  ) : null}
                </g>
              );
            })}
        </svg>
      </div>
      <div className={`absolute bottom-0 left-0 ${band}`} style={{ top: topH, width: leftW }}>
        <svg width={leftW} height={Math.max(viewportSize.height - topH, 0)} aria-hidden>
          {marks
            .filter((mark) => mark.axis === "y")
            .map((mark, index) => {
              const screen = mapSvgToScreen(viewBox.x, mark.svg, viewBox, pan, scale);
              const y = screen.y - topH;
              if (y < 0 || y > viewportSize.height - topH) return null;
              const tick = mark.major ? 8 : 5;
              return (
                <g key={`ruler-left-${mark.svg}-${index}`}>
                  <line
                    x1={leftW - tick}
                    y1={y}
                    x2={leftW}
                    y2={y}
                    stroke={chrome.rulerLine}
                    strokeWidth={1}
                  />
                  {mark.label ? (
                    <text
                      x={leftW - tick - 3}
                      y={y}
                      fontSize={10}
                      textAnchor="end"
                      dominantBaseline="middle"
                      fill={chrome.rulerText}
                      stroke={chrome.rulerTextStroke}
                      strokeWidth={2}
                      paintOrder="stroke fill"
                      className="combat-map-svg-text"
                    >
                      {mark.label}
                    </text>
                  ) : null}
                </g>
              );
            })}
        </svg>
      </div>
    </div>
  );
}

function MeterSizeFields({
  metersPerUnit,
  widthSvg,
  heightSvg,
  onWidthMeters,
  onHeightMeters,
}: {
  metersPerUnit: number;
  widthSvg: string | undefined;
  heightSvg: string | undefined;
  onWidthMeters: (meters: string) => void;
  onHeightMeters: (meters: string) => void;
}) {
  const { t } = useT();
  const widthMeters = svgLengthToMeterField(widthSvg, metersPerUnit);
  const heightMeters = svgLengthToMeterField(heightSvg, metersPerUnit);
  const [widthDraft, setWidthDraft] = useState(widthMeters);
  const [heightDraft, setHeightDraft] = useState(heightMeters);

  useEffect(() => {
    setWidthDraft(widthMeters);
  }, [widthMeters]);

  useEffect(() => {
    setHeightDraft(heightMeters);
  }, [heightMeters]);

  return (
    <>
      <TextField
        label={t("combat.editor.props.width")}
        type="number"
        step={0.1}
        value={widthDraft}
        onChange={setWidthDraft}
        onBlur={() => {
          if (widthDraft !== widthMeters) onWidthMeters(widthDraft);
        }}
      />
      <TextField
        label={t("combat.editor.props.height")}
        type="number"
        step={0.1}
        value={heightDraft}
        onChange={setHeightDraft}
        onBlur={() => {
          if (heightDraft !== heightMeters) onHeightMeters(heightDraft);
        }}
      />
    </>
  );
}

function PropertyColorField({
  id,
  label,
  value,
  fallback,
  onPatch,
  onPreviewPatch,
}: {
  id: string;
  label: string;
  value: string;
  fallback: string;
  onPatch: (id: string, patch: Record<string, string>) => void;
  onPreviewPatch: (id: string, patch: Record<string, string>) => void;
}) {
  return (
    <ColorField
      label={label}
      value={value}
      fallback={fallback}
      onPreview={(next) => onPreviewPatch(id, { fill: next })}
      onChange={(next) => onPatch(id, { fill: next })}
    />
  );
}

function CoverPresetField({
  kind,
  attrs,
  onApply,
  t,
}: {
  kind: "barrier" | "concealment";
  attrs: Record<string, string>;
  onApply: (patch: Record<string, string>) => void;
  t: (key: string) => string;
}) {
  const match = findMatchingCoverPreset(attrs, kind);
  return (
    <SelectField
      label={t("combat.editor.props.coverPreset")}
      value={match?.id ?? ""}
      onChange={(id) => {
        const preset = coverPresetsForKind(kind).find((entry) => entry.id === id);
        if (preset) onApply(coverPresetAttrs(preset));
      }}
      options={[
        { value: "", label: t("combat.editor.props.coverPresetCustom") },
        ...coverPresetSelectOptions(kind, t),
      ]}
    />
  );
}

function PropertyStrokeField({
  id,
  label,
  value,
  fallback,
  onPatch,
  onPreviewPatch,
}: {
  id: string;
  label: string;
  value: string;
  fallback: string;
  onPatch: (id: string, patch: Record<string, string>) => void;
  onPreviewPatch: (id: string, patch: Record<string, string>) => void;
}) {
  return (
    <ColorField
      label={label}
      value={value}
      fallback={fallback}
      onPreview={(next) => onPreviewPatch(id, { stroke: next })}
      onChange={(next) => onPatch(id, { stroke: next })}
    />
  );
}

function MultiSelectPropertyPanel({
  elements,
  onPatchMany,
  onPreviewMany,
  onDeleteMany,
  t,
}: {
  elements: CombatMapElement[];
  onPatchMany: (patch: Record<string, string>) => void;
  onPreviewMany: (patch: Record<string, string>) => void;
  onDeleteMany: () => void;
  t: (key: string) => string;
}) {
  const mixedLabel = t("combat.editor.props.mixed");
  const fillFallback = sharedRoomSelection(elements) ? "#FFCC24" : sharedConcealmentSelection(elements) ? "#D9D9D9" : "#c8c8c8";
  const strokeFallback = sharedConcealmentSelection(elements) ? "#4a6785" : "#5c5c5c";

  return (
    <div className="flex flex-col gap-4 p-4">
      <p className="text-sm font-medium text-foreground/70">
        {t("combat.editor.props.multiSelect").replace("{count}", String(elements.length))}
      </p>
      {sharedRoomSelection(elements) ? (
        <ColorField
          label={t("combat.editor.props.fill")}
          value={displaySharedAttr(sharedElementAttr(elements, "fill", (el) => el.attrs.fill ?? "#FFCC24"))}
          placeholder={sharedAttrPlaceholder(sharedElementAttr(elements, "fill", (el) => el.attrs.fill ?? "#FFCC24")) ?? mixedLabel}
          fallback="#FFCC24"
          onPreview={(value) => onPreviewMany({ fill: value })}
          onChange={(value) => onPatchMany({ fill: value })}
        />
      ) : null}
      {sharedBarrierSelection(elements) ? (
        <CoverPresetField
          kind="barrier"
          attrs={elements[0]!.attrs}
          onApply={onPatchMany}
          t={t}
        />
      ) : null}
      {sharedConcealmentSelection(elements) ? (
        <CoverPresetField
          kind="concealment"
          attrs={elements[0]!.attrs}
          onApply={onPatchMany}
          t={t}
        />
      ) : null}
      {sharedWallLikeKeys(elements) ? (
        <>
          <ColorField
            label={t("combat.editor.props.fill")}
            value={displaySharedAttr(sharedElementAttr(elements, "fill", (el) => el.attrs.fill ?? fillFallback))}
            placeholder={sharedAttrPlaceholder(sharedElementAttr(elements, "fill", (el) => el.attrs.fill ?? fillFallback)) ?? mixedLabel}
            fallback={fillFallback}
            onPreview={(value) => onPreviewMany({ fill: value })}
            onChange={(value) => onPatchMany({ fill: value })}
          />
          <ColorField
            label={t("combat.editor.props.stroke")}
            value={displaySharedAttr(sharedElementAttr(elements, "stroke", (el) => el.attrs.stroke ?? strokeFallback))}
            placeholder={sharedAttrPlaceholder(sharedElementAttr(elements, "stroke", (el) => el.attrs.stroke ?? strokeFallback)) ?? mixedLabel}
            fallback={strokeFallback}
            onPreview={(value) => onPreviewMany({ stroke: value })}
            onChange={(value) => onPatchMany({ stroke: value })}
          />
          <TextField
            label="AR"
            type="number"
            value={displaySharedAttr(sharedElementAttr(elements, "ar"))}
            placeholder={sharedAttrPlaceholder(sharedElementAttr(elements, "ar")) ?? mixedLabel}
            onChange={(value) => onPatchMany({ ar: value })}
          />
          <TextField
            label="SSP"
            type="number"
            value={displaySharedAttr(sharedElementAttr(elements, "ssp"))}
            placeholder={sharedAttrPlaceholder(sharedElementAttr(elements, "ssp")) ?? mixedLabel}
            onChange={(value) => onPatchMany({ ssp: value })}
          />
        </>
      ) : null}
      {sharedConcealmentSelection(elements) ? (
        <SelectField
          label={t("combat.editor.props.coverHeight")}
          value={
            sharedElementAttr(elements, "cover-height", (el) =>
              normalizeCoverHeightFraction(el.attrs["cover-height"]),
            ) === COMBAT_MAP_SHARED_MIXED
              ? ""
              : displaySharedAttr(
                  sharedElementAttr(elements, "cover-height", (el) =>
                    normalizeCoverHeightFraction(el.attrs["cover-height"]),
                  ),
                )
          }
          onChange={(value) => onPatchMany({ "cover-height": value })}
          options={coverHeightSelectOptions(t)}
        />
      ) : null}
      {elements.every((el) => canDeleteCombatMapElement(el)) ? (
        <Button variant="danger" className="font-semibold" onPress={onDeleteMany}>
          {t("combat.editor.delete")}
        </Button>
      ) : null}
    </div>
  );
}

function PlayOverlayToggleRow({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Button
      variant={active ? "primary" : "ghost"}
      className="h-9 justify-start rounded-xl px-3 text-sm font-semibold"
      onPress={onPress}
      aria-pressed={active}
    >
      {label}
    </Button>
  );
}

function PlayOverlayTogglesPanel({
  playOverlayToggles,
  onPlayOverlayTogglesChange,
  t,
}: {
  playOverlayToggles: CombatMapPlayOverlayToggles;
  onPlayOverlayTogglesChange: (next: CombatMapPlayOverlayToggles) => void;
  t: ReturnType<typeof useT>["t"];
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-foreground/50">
        {t("combat.editor.playOverlays.title")}
      </p>
      <div className="flex flex-col gap-1">
        <PlayOverlayToggleRow
          label={t("combat.editor.playOverlays.fov")}
          active={playOverlayToggles.fov}
          onPress={() => onPlayOverlayTogglesChange({ ...playOverlayToggles, fov: !playOverlayToggles.fov })}
        />
        <PlayOverlayToggleRow
          label={t("combat.editor.playOverlays.cover")}
          active={playOverlayToggles.cover}
          onPress={() =>
            onPlayOverlayTogglesChange({ ...playOverlayToggles, cover: !playOverlayToggles.cover })
          }
        />
        <PlayOverlayToggleRow
          label={t("combat.editor.playOverlays.path")}
          active={playOverlayToggles.path}
          onPress={() =>
            onPlayOverlayTogglesChange({ ...playOverlayToggles, path: !playOverlayToggles.path })
          }
        />
      </div>
    </div>
  );
}

function PropertyPanel({
  map,
  selected,
  selectedElements,
  selectionCount,
  readOnly = false,
  playOverlayToggles,
  onPlayOverlayTogglesChange,
  onPatch,
  onPatchMany,
  onPreviewPatch,
  onPreviewMany,
  onDelete,
  onDeleteMany,
}: {
  map: CombatMapDocument;
  selected: CombatMapElement | null;
  selectedElements: CombatMapElement[];
  selectionCount: number;
  readOnly?: boolean;
  playOverlayToggles?: CombatMapPlayOverlayToggles;
  onPlayOverlayTogglesChange?: (next: CombatMapPlayOverlayToggles) => void;
  onPatch: (id: string, patch: Record<string, string>) => void;
  onPatchMany: (patch: Record<string, string>) => void;
  onPreviewPatch: (id: string, patch: Record<string, string>) => void;
  onPreviewMany: (patch: Record<string, string>) => void;
  onDelete: (id: string) => void;
  onDeleteMany: () => void;
}) {
  const { t } = useT();
  const { sheets } = useSheetApp();
  const metersPerUnit = combatMapMetersPerUnit(map.svg);

  if (selectionCount > 1) {
    return (
      <MultiSelectPropertyPanel
        elements={selectedElements}
        onPatchMany={onPatchMany}
        onPreviewMany={onPreviewMany}
        onDeleteMany={onDeleteMany}
        t={t}
      />
    );
  }
  const patchWidthMeters = (id: string, meters: string) => {
    const units = meterFieldToSvgLength(meters, metersPerUnit);
    if (units) onPatch(id, { width: units });
  };
  const patchHeightMeters = (id: string, meters: string) => {
    const units = meterFieldToSvgLength(meters, metersPerUnit);
    if (units) onPatch(id, { height: units });
  };

  if (!selected) {
    if (readOnly && playOverlayToggles && onPlayOverlayTogglesChange) {
      return (
        <div className="flex flex-col gap-4 p-4">
          <PlayOverlayTogglesPanel
            playOverlayToggles={playOverlayToggles}
            onPlayOverlayTogglesChange={onPlayOverlayTogglesChange}
            t={t}
          />
        </div>
      );
    }
    const bounds = boundingBoxElement(map.svg);
    const bg = mapBackgroundColor(map.svg);
    return (
      <div className="flex flex-col gap-4 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-foreground/50">
          {t("combat.editor.props.map")}
        </p>
        {bounds ? (
          <MeterSizeFields
            metersPerUnit={metersPerUnit}
            widthSvg={bounds.attrs.width}
            heightSvg={bounds.attrs.height}
            onWidthMeters={(v) => patchWidthMeters(bounds.id, v)}
            onHeightMeters={(v) => patchHeightMeters(bounds.id, v)}
          />
        ) : null}
        {bounds ? (
          <PropertyColorField
            id={bounds.id}
            label={t("combat.editor.props.background")}
            value={bg}
            fallback={COMBAT_MAP_DEFAULT_BOUNDS_FILL}
            onPatch={onPatch}
            onPreviewPatch={onPreviewPatch}
          />
        ) : null}
      </div>
    );
  }

  if (selected.kind === "room") {
    return (
      <div className="flex flex-col gap-4 p-4">
        <MeterSizeFields
          metersPerUnit={metersPerUnit}
          widthSvg={selected.attrs.width}
          heightSvg={selected.attrs.height}
          onWidthMeters={(v) => patchWidthMeters(selected.id, v)}
          onHeightMeters={(v) => patchHeightMeters(selected.id, v)}
        />
        <PropertyColorField
          id={selected.id}
          label={t("combat.editor.props.fill")}
          value={selected.attrs.fill ?? "#FFCC24"}
          fallback="#FFCC24"
          onPatch={onPatch}
          onPreviewPatch={onPreviewPatch}
        />
        {canDeleteCombatMapElement(selected) ? (
          <Button variant="danger" className="font-semibold" onPress={() => onDelete(selected.id)}>
            {t("combat.editor.delete")}
          </Button>
        ) : null}
      </div>
    );
  }

  if (selected.kind === "bounding_box") {
    return (
      <div className="flex flex-col gap-4 p-4">
        <MeterSizeFields
          metersPerUnit={metersPerUnit}
          widthSvg={selected.attrs.width}
          heightSvg={selected.attrs.height}
          onWidthMeters={(v) => patchWidthMeters(selected.id, v)}
          onHeightMeters={(v) => patchHeightMeters(selected.id, v)}
        />
        <PropertyColorField
          id={selected.id}
          label={t("combat.editor.props.fill")}
          value={selected.attrs.fill ?? COMBAT_MAP_DEFAULT_BOUNDS_FILL}
          fallback={COMBAT_MAP_DEFAULT_BOUNDS_FILL}
          onPatch={onPatch}
          onPreviewPatch={onPreviewPatch}
        />
        <PropertyStrokeField
          id={selected.id}
          label={t("combat.editor.props.stroke")}
          value={selected.attrs.stroke ?? COMBAT_MAP_DEFAULT_BOUNDS_STROKE}
          fallback={COMBAT_MAP_DEFAULT_BOUNDS_STROKE}
          onPatch={onPatch}
          onPreviewPatch={onPreviewPatch}
        />
      </div>
    );
  }

  if (selected.kind === "npc_token") {
    const sheetId = selected.attrs["sheet-id"] ?? "";
    const sheet = sheets.find((s) => s.id === sheetId);
    const inventory = sheet ? readOpcodeInventory(sheet.status) : [];
    const weapon = sheet ? selectPrimaryRangedWeapon(inventory) : null;
    const summary = sheet ? readOpcodeSheetSummary(sheet.stats, sheet.status) : null;
    const difficulty = (selected.attrs["ai-difficulty"] ?? "trained") as NpcDifficultyId;
    return (
      <div className="flex flex-col gap-4 p-4">
        {!readOnly ? (
          <TextField
            label={t("combat.editor.props.tokenDiameter")}
            value={String(Math.round(npcTokenDiameterMFromAttrs(selected.attrs, metersPerUnit) * 10) / 10)}
            onChange={(value) => {
              const r = patchNpcTokenRadiusFromDiameterM(value, metersPerUnit);
              if (r) onPatch(selected.id, { r });
            }}
          />
        ) : null}
        <Field label={t("combat.editor.props.boundNpc")}>
          <p className="text-sm font-medium">{sheet ? sheetListLabel(sheet) : sheetId || "—"}</p>
        </Field>
        {!readOnly ? (
          <SelectField
            label={t("combat.editor.props.rebindNpc")}
            value={sheetId}
            onChange={(v) => onPatch(selected.id, { "sheet-id": v })}
            options={sheets.filter(sheetHasRangedWeapon).map((s) => ({ value: s.id, label: sheetListLabel(s) }))}
          />
        ) : null}
        {summary ? (
          <Field label={t("combat.editor.props.skills")}>
            <p className="text-sm text-foreground/70">
              {summary.skills.slice(0, 4).map((s) => s.name).join(", ") || "—"}
            </p>
          </Field>
        ) : null}
        {weapon ? (
          <Field label={t("combat.editor.props.weapon")}>
            <p className="text-sm text-foreground/70">{weapon.name || weapon.weapon?.type || "—"}</p>
          </Field>
        ) : null}
        {readOnly ? (
          <Field label={t("combat.bench.difficultyLabel")}>
            <p className="text-sm text-foreground/70">{t(`combat.bench.difficulty.${difficulty}`)}</p>
          </Field>
        ) : (
          <SelectField
            label={t("combat.bench.difficultyLabel")}
            value={difficulty}
            onChange={(v) => onPatch(selected.id, { "ai-difficulty": v })}
            options={NPC_DIFFICULTY_IDS.map((id) => ({
              value: id,
              label: t(`combat.bench.difficulty.${id}`),
            }))}
          />
        )}
        {readOnly && playOverlayToggles && onPlayOverlayTogglesChange ? (
          <PlayOverlayTogglesPanel
            playOverlayToggles={playOverlayToggles}
            onPlayOverlayTogglesChange={onPlayOverlayTogglesChange}
            t={t}
          />
        ) : null}
        <p className="text-xs text-foreground/50">{t("combat.editor.props.editInSheet")}</p>
        {!readOnly && canDeleteCombatMapElement(selected) ? (
          <Button variant="danger" className="font-semibold" onPress={() => onDelete(selected.id)}>
            {t("combat.editor.delete")}
          </Button>
        ) : null}
      </div>
    );
  }

  if (selected.kind === "barrier") {
    return (
      <div className="flex flex-col gap-4 p-4">
        {selected.tag === "rect" ? (
          <MeterSizeFields
            metersPerUnit={metersPerUnit}
            widthSvg={selected.attrs.width}
            heightSvg={selected.attrs.height}
            onWidthMeters={(v) => patchWidthMeters(selected.id, v)}
            onHeightMeters={(v) => patchHeightMeters(selected.id, v)}
          />
        ) : null}
        <PropertyColorField
          id={selected.id}
          label={t("combat.editor.props.fill")}
          value={selected.attrs.fill ?? "#c8c8c8"}
          fallback="#c8c8c8"
          onPatch={onPatch}
          onPreviewPatch={onPreviewPatch}
        />
        <PropertyStrokeField
          id={selected.id}
          label={t("combat.editor.props.stroke")}
          value={selected.attrs.stroke ?? "#5c5c5c"}
          fallback="#5c5c5c"
          onPatch={onPatch}
          onPreviewPatch={onPreviewPatch}
        />
        <CoverPresetField
          kind="barrier"
          attrs={selected.attrs}
          onApply={(patch) => onPatch(selected.id, patch)}
          t={t}
        />
        <TextField
          label="AR"
          type="number"
          value={selected.attrs.ar ?? ""}
          onChange={(v) => onPatch(selected.id, { ar: v })}
        />
        <TextField
          label={t("combat.editor.props.name")}
          value={selected.attrs.name ?? selected.id}
          onChange={(v) => onPatch(selected.id, { name: v })}
        />
        <TextField
          label="SSP"
          type="number"
          value={selected.attrs.ssp ?? ""}
          onChange={(v) => onPatch(selected.id, { ssp: v })}
        />
        {selected.tag === "path" ? (
          <TextField
            label={t("combat.editor.props.path")}
            value={selected.attrs.d ?? ""}
            onChange={(v) => onPatch(selected.id, { d: v })}
          />
        ) : null}
        {canDeleteCombatMapElement(selected) ? (
          <Button variant="danger" className="font-semibold" onPress={() => onDelete(selected.id)}>
            {t("combat.editor.delete")}
          </Button>
        ) : null}
      </div>
    );
  }

  if (selected.kind === "concealment") {
    return (
      <div className="flex flex-col gap-4 p-4">
        {selected.tag === "rect" ? (
          <MeterSizeFields
            metersPerUnit={metersPerUnit}
            widthSvg={selected.attrs.width}
            heightSvg={selected.attrs.height}
            onWidthMeters={(v) => patchWidthMeters(selected.id, v)}
            onHeightMeters={(v) => patchHeightMeters(selected.id, v)}
          />
        ) : null}
        <PropertyColorField
          id={selected.id}
          label={t("combat.editor.props.fill")}
          value={selected.attrs.fill ?? "#D9D9D9"}
          fallback="#D9D9D9"
          onPatch={onPatch}
          onPreviewPatch={onPreviewPatch}
        />
        <PropertyStrokeField
          id={selected.id}
          label={t("combat.editor.props.stroke")}
          value={selected.attrs.stroke ?? "#4a6785"}
          fallback="#4a6785"
          onPatch={onPatch}
          onPreviewPatch={onPreviewPatch}
        />
        <CoverPresetField
          kind="concealment"
          attrs={selected.attrs}
          onApply={(patch) => onPatch(selected.id, patch)}
          t={t}
        />
        <TextField
          label="AR"
          type="number"
          value={selected.attrs.ar ?? ""}
          onChange={(v) => onPatch(selected.id, { ar: v })}
        />
        <TextField
          label={t("combat.editor.props.name")}
          value={selected.attrs.name ?? selected.id}
          onChange={(v) => onPatch(selected.id, { name: v })}
        />
        <SelectField
          label={t("combat.editor.props.coverHeight")}
          value={normalizeCoverHeightFraction(selected.attrs["cover-height"])}
          onChange={(v) => onPatch(selected.id, { "cover-height": v })}
          options={coverHeightSelectOptions(t)}
        />
        <TextField
          label="SSP"
          type="number"
          value={selected.attrs.ssp ?? ""}
          onChange={(v) => onPatch(selected.id, { ssp: v })}
        />
        {selected.tag === "path" ? (
          <TextField
            label={t("combat.editor.props.path")}
            value={selected.attrs.d ?? ""}
            onChange={(v) => onPatch(selected.id, { d: v })}
          />
        ) : null}
        {canDeleteCombatMapElement(selected) ? (
          <Button variant="danger" className="font-semibold" onPress={() => onDelete(selected.id)}>
            {t("combat.editor.delete")}
          </Button>
        ) : null}
      </div>
    );
  }

  return null;
}

const EMPTY_EDITOR_MAP: CombatMapDocument = {
  id: "",
  title: "",
  svg: "<svg></svg>",
  inCombat: false,
  updated_at: "",
};

export function CombatMapEditor() {
  const { t } = useT();
  const { sheets } = useSheetApp();
  const { map: loadedMap, selectedIds, setSelectedIds, setMap, saveEditorMap } = useCombatEditorMap();
  const { layout, setLayout } = useCombatEditorMeta();
  const map = loadedMap ?? EMPTY_EDITOR_MAP;
  const onMapChange = setMap;
  const onSave = saveEditorMap;
  const onSelectIds = setSelectedIds;
  const onLayoutChange = setLayout;
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const mapSvgHostRef = useRef<HTMLDivElement>(null);
  const editOverlayRef = useRef<SVGSVGElement>(null);
  const screenOverlayRef = useRef<SVGSVGElement>(null);
  const rotateCursorRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef(map);
  mapRef.current = map;
  const historyRef = useRef(createCombatMapHistory(map.svg));
  const panRef = useRef({ x: 0, y: 0 });
  const scaleRef = useRef(1);
  const panDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originPanX: number;
    originPanY: number;
    moved: boolean;
    tapSelectId?: string;
    playTap?: boolean;
  } | null>(null);
  const elementDragRef = useRef<{
    pointerId: number;
    dragId: string;
    moveIds: string[];
    startClientX: number;
    startClientY: number;
    originSvg: string;
    moved: boolean;
    pendingSvg?: string;
  } | null>(null);
  const drawDragRef = useRef<{
    pointerId: number;
    start: { x: number; y: number };
    current: { x: number; y: number };
    bounds: { x: number; y: number; width: number; height: number };
    startClientX: number;
    startClientY: number;
  } | null>(null);
  const vertexDragRef = useRef<{
    pointerId: number;
    id: string;
    index: number;
    pendingSvg?: string;
  } | null>(null);
  const scaleDragRef = useRef<{
    pointerId: number;
    ids: string[];
    handle: ScaleHandleId;
    originSvg: string;
    originBounds: { x: number; y: number; width: number; height: number };
    pendingSvg?: string;
  } | null>(null);
  const rotateDragRef = useRef<{
    pointerId: number;
    ids: string[];
    originSvg: string;
    originDeg: number;
    startPointerDeg: number;
    pivot: { x: number; y: number };
    groupRotate: boolean;
    pendingSvg?: string;
  } | null>(null);
  const spacePanRef = useRef(false);
  const spacePanRestoreToolRef = useRef<CombatEditorTool | null>(null);
  const svgClipboardRef = useRef<string | null>(null);
  const selectedIdsRef = useRef(selectedIds);
  const toolRef = useRef<CombatEditorTool>("select");
  const [tool, setTool] = useState<CombatEditorTool>("select");
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [spacePanHeld, setSpacePanHeld] = useState(false);
  const [draggingElementId, setDraggingElementId] = useState<string | null>(null);
  const [drawPreview, setDrawPreview] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [marqueePreview, setMarqueePreview] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [hoverOobElementId, setHoverOobElementId] = useState<string | null>(null);
  const marqueeDragRef = useRef<{
    pointerId: number;
    start: { x: number; y: number };
    originIds: string[];
    additive: boolean;
  } | null>(null);
  const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([]);
  const [viewportSize, setViewportSize] = useState({ width: 1, height: 1 });
  const [npcModalOpen, setNpcModalOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [complianceOpen, setComplianceOpen] = useState(false);
  const [importFailure, setImportFailure] = useState<CombatMapImportResult | null>(null);
  const [pendingNpcSheetId, setPendingNpcSheetId] = useState<string | null>(null);
  const router = useRouter();
  const { importMapFromText } = useCombatList();
  const [saving, setSaving] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; id: string } | null>(null);
  const [showGrid, setShowGrid] = useState(false);
  const [playOverlayToggles, setPlayOverlayToggles] = useState(DEFAULT_COMBAT_MAP_PLAY_OVERLAY_TOGGLES);
  const [compiledPlayMap, setCompiledPlayMap] = useState<CompiledCombatMap | null>(null);
  const showGridRef = useRef(showGrid);
  const gridSnapRef = useRef<MeterGridSnap | null>(null);

  panRef.current = pan;
  scaleRef.current = scale;
  toolRef.current = tool;
  selectedIdsRef.current = selectedIds;
  showGridRef.current = showGrid;
  const drawToolActive = combatDrawToolActive(tool, spacePanHeld);

  const elements = useMemo(() => parseCombatMapElements(map.svg), [map.svg]);
  const complianceReport = useMemo(
    () => combatMapComplianceReport({ svg: map.svg, layerGroups: map.layerGroups }),
    [map.layerGroups, map.svg],
  );
  const selectedElements = useMemo(
    () =>
      selectedIds
        .map((id) => elements.find((entry) => entry.id === id))
        .filter((entry): entry is CombatMapElement => Boolean(entry)),
    [elements, selectedIds],
  );
  const primaryId = primarySelectionId(selectedIds);
  const selected = primaryId ? (elements.find((e) => e.id === primaryId) ?? null) : null;
  const viewBox = useMemo(() => parseSvgViewBox(map.svg), [map.svg]);
  const artboard = useMemo(() => {
    if (!viewBox) return null;
    return combatMapArtboardRect(map.svg, viewBox);
  }, [map.svg, viewBox]);
  const pathVertices = useMemo(() => {
    if (selected?.tag !== "path" || !selected.attrs.d) return [];
    return parsePathD(selected.attrs.d);
  }, [selected]);
  const selectedOutlineBounds = useMemo((): SelectionOutline[] => {
    return selectedIds
      .map((id) => {
        const el = elements.find((entry) => entry.id === id);
        if (!el) return null;
        const corners = selectionOutlineCorners(el);
        if (corners) return { id, kind: "polygon" as const, corners };
        const bounds = combatMapElementBounds(el);
        if (!bounds) return null;
        return { id, kind: "rect" as const, bounds };
      })
      .filter((entry): entry is SelectionOutline => Boolean(entry));
  }, [selectedIds, elements]);
  const transformIds = useMemo(
    () => transformableSelectionIds(elements, selectedIds),
    [elements, selectedIds],
  );
  const groupSelectionBounds = useMemo(() => {
    if (transformIds.length < 2) return null;
    return selectionGroupBounds(elements, selectedIds);
  }, [elements, selectedIds, transformIds.length]);
  const scaleHandles = useMemo(() => {
    if (groupSelectionBounds) {
      return scaleHandlePositions(groupSelectionBounds);
    }
    if (!selected || selected.tag !== "rect") return null;
    const bounds = combatMapElementBounds(selected) ?? rectLocalBounds(selected);
    if (!bounds) return null;
    return scaleHandlePositions(bounds);
  }, [groupSelectionBounds, selected]);
  const metersPerUnit = useMemo(() => combatMapMetersPerUnit(map.svg), [map.svg]);

  useEffect(() => {
    if (layout !== "play") {
      setCompiledPlayMap(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { compileOpcodeMap } = await import("@/lib/combat/map-adapter/compile-opcode-map");
      const { combatTestPlaceholderDocument } = await import("@/lib/combat/combat-test-scene");
      const compiled = compileOpcodeMap(
        combatTestPlaceholderDocument(map.svg, map.id, metersPerUnit),
      );
      if (!cancelled) setCompiledPlayMap(compiled);
    })();
    return () => {
      cancelled = true;
    };
  }, [layout, map.svg, map.id, metersPerUnit]);

  const npcPlacements = useMemo(
    () =>
      combatMapNpcPlacements(elements, map.svg, metersPerUnit, (sheetId) => {
        const sheet = sheets.find((entry) => entry.id === sheetId);
        return sheet ? sheetListLabel(sheet) : sheetId;
      }),
    [elements, map.svg, metersPerUnit, sheets],
  );

  const selectedNpcPlacement = useMemo(() => {
    if (!primaryId) return null;
    return npcPlacements.find((placement) => placement.id === primaryId) ?? null;
  }, [npcPlacements, primaryId]);

  const playOverlayLayers = useMemo(() => {
    if (layout !== "play" || !compiledPlayMap || !selectedNpcPlacement) return null;
    const sheet = sheets.find((entry) => entry.id === selectedNpcPlacement.sheetId);
    return buildCombatMapPlayOverlay({
      map: compiledPlayMap,
      placement: selectedNpcPlacement,
      placements: npcPlacements,
      sheet,
    });
  }, [layout, compiledPlayMap, selectedNpcPlacement, npcPlacements, sheets]);
  const mapChrome = useMemo(() => combatMapEditorChrome(mapBackgroundColor(map.svg)), [map.svg]);
  const boundsElement = useMemo(() => boundingBoxElement(map.svg), [map.svg]);
  const mapBoundsStroke = useMemo(
    () => (boundsElement ? combatMapBoundsStroke(boundsElement, mapChrome) : null),
    [boundsElement, mapChrome],
  );
  const showMapBoundsStroke =
    boundsElement && mapBoundsStroke && !selectedIds.includes(boundsElement.id);
  const gridStepM = useMemo(
    () => pickCombatMapGridStepMeters(scale, metersPerUnit),
    [metersPerUnit, scale],
  );
  gridSnapRef.current =
    showGrid && artboard ? meterGridSnapFromArtboard(artboard, metersPerUnit, gridStepM) : null;
  const rulerStepM = useMemo(
    () => pickRulerTickStepMeters(scale, metersPerUnit),
    [metersPerUnit, scale],
  );
  const rulerMarks = useMemo(() => {
    if (!artboard || !showGrid || !viewBox) return [];
    const range = visibleMapSvgRect(viewBox, pan, scale, viewportSize, {
      top: COMBAT_MAP_VIEWPORT_RULER_TOP_H,
      left: COMBAT_MAP_VIEWPORT_RULER_LEFT_W,
      right: 0,
      bottom: 0,
    });
    return buildCombatMapRulerMarksInRange(artboard, metersPerUnit, rulerStepM, range);
  }, [artboard, metersPerUnit, rulerStepM, showGrid, viewBox, pan, scale, viewportSize]);
  const collectSnapTargets = useCallback((svg: string, excludeId?: string) => {
    return collectCombatMapSnapTargets(svg, excludeId);
  }, []);

  function mapPreviewRoots() {
    return {
      mapRoot: mapSvgHostRef.current,
      overlayRoot: editOverlayRef.current,
    };
  }

  function showRotateCursor(clientX: number, clientY: number) {
    const cursor = rotateCursorRef.current;
    const viewport = viewportRef.current;
    if (!cursor || !viewport) return;
    const rect = viewport.getBoundingClientRect();
    cursor.style.display = "block";
    cursor.style.left = `${clientX - rect.left}px`;
    cursor.style.top = `${clientY - rect.top}px`;
    viewport.style.cursor = "none";
  }

  function hideRotateCursor() {
    rotateCursorRef.current && (rotateCursorRef.current.style.display = "none");
    if (viewportRef.current) viewportRef.current.style.cursor = "";
  }

  const touchMap = useCallback(
    (patch: Partial<CombatMapDocument>) => {
      onMapChange({ ...mapRef.current, ...patch, updated_at: new Date().toISOString() });
    },
    [onMapChange],
  );

  const changeMapSvg = useCallback(
    (svg: string) => {
      if (svg === mapRef.current.svg) return;
      historyRef.current = pushCombatMapHistory(historyRef.current, svg);
      touchMap({
        svg,
        layerGroups: pruneCombatMapLayerGroups(svg, mapRef.current.layerGroups),
      });
    },
    [touchMap],
  );

  const undoMap = useCallback(() => {
    const { history, svg } = undoCombatMapHistory(historyRef.current);
    if (!svg) return;
    historyRef.current = history;
    touchMap({ svg, layerGroups: pruneCombatMapLayerGroups(svg, mapRef.current.layerGroups) });
  }, [touchMap]);

  const redoMap = useCallback(() => {
    const { history, svg } = redoCombatMapHistory(historyRef.current);
    if (!svg) return;
    historyRef.current = history;
    touchMap({ svg, layerGroups: pruneCombatMapLayerGroups(svg, mapRef.current.layerGroups) });
  }, [touchMap]);

  function commitPendingDragSvg(pendingSvg: string | undefined) {
    if (!pendingSvg || pendingSvg === mapRef.current.svg) return;
    changeMapSvg(pendingSvg);
  }

  function previewSelectionOutline(id: string, el: CombatMapElement) {
    const overlay = screenOverlayRef.current;
    const vb = parseSvgViewBox(mapRef.current.svg);
    if (!overlay || !vb) return;
    const node = overlay.querySelector(`[data-selection-outline="${CSS.escape(id)}"]`);
    if (!node) return;
    const corners = selectionOutlineCorners(el);
    if (corners && node instanceof SVGPolygonElement) {
      node.setAttribute(
        "points",
        corners
          .map((corner) => {
            const screen = mapSvgToScreen(corner.x, corner.y, vb, panRef.current, scaleRef.current);
            return `${screen.x},${screen.y}`;
          })
          .join(" "),
      );
      return;
    }
    const bounds = combatMapElementBounds(el);
    if (bounds && node instanceof SVGRectElement) {
      const screen = combatMapBoundsToScreenRect(bounds, vb, panRef.current, scaleRef.current);
      node.setAttribute("x", String(screen.x));
      node.setAttribute("y", String(screen.y));
      node.setAttribute("width", String(screen.width));
      node.setAttribute("height", String(screen.height));
    }
  }

  function previewSvgElementDiff(originSvg: string, nextSvg: string, ids: readonly string[]) {
    const { mapRoot, overlayRoot } = mapPreviewRoots();
    if (!mapRoot) return;
    const before = new Map(parseCombatMapElements(originSvg).map((entry) => [entry.id, entry]));
    for (const id of ids) {
      const after = parseCombatMapElements(nextSvg).find((entry) => entry.id === id);
      const prev = before.get(id);
      if (!after || !prev) continue;
      if (after.tag === "rect") {
        previewMapRect(mapRoot, overlayRoot, id, rectPatchFromAttrs(after.attrs));
      } else if (after.tag === "path" && after.attrs.d) {
        previewMapPath(mapRoot, overlayRoot, id, { d: after.attrs.d });
      }
      if (selectedIdsRef.current.includes(id)) {
        previewSelectionOutline(id, after);
      }
    }
  }
  const displaySvg = useMemo(() => {
    let svg = prepareCombatMapSvgForDisplay(map.svg, "editor");
    if (artboard) {
      const oobIds = elements
        .filter((el) => elementOutsideArtboard(el, artboard))
        .map((el) => el.id);
      svg = applyCombatMapOobInsideClip(svg, artboard, oobIds);
    }
    return svg.replace(
      /<\/style>/i,
      `.combat-map-svg [name]:not([type="bounding_box"]){cursor:grab;pointer-events:auto;}
.combat-map-svg circle[type="npc_token"]{pointer-events:auto;cursor:pointer;}
.combat-map-play-mode .combat-map-svg circle[type="npc_token"]{cursor:grab;}
.combat-map-play-mode .combat-map-svg circle[type="npc_token"][data-selected="true"]{cursor:grabbing;}
.combat-map-svg rect[type="barrier"],.combat-map-svg rect[type="concealment"],.combat-map-svg rect[type="room"],.combat-map-svg path[type="barrier"],.combat-map-svg path[type="concealment"]{pointer-events:auto;cursor:grab;}
.combat-map-svg [data-selected="true"]{cursor:grabbing;}
.combat-map-draw-mode .combat-map-svg [name],.combat-map-draw-mode .combat-map-svg rect[type="barrier"],.combat-map-draw-mode .combat-map-svg rect[type="concealment"],.combat-map-draw-mode .combat-map-svg rect[type="room"],.combat-map-draw-mode .combat-map-svg path[type="barrier"],.combat-map-draw-mode .combat-map-svg path[type="concealment"]{pointer-events:none!important;}</style>`,
    );
  }, [map.svg, artboard, elements]);

  const weaponSheets = useMemo(() => sheets.filter(sheetHasRangedWeapon), [sheets]);
  const viewportFittedRef = useRef(false);

  useEffect(() => {
    viewportFittedRef.current = false;
  }, [map.id, layout]);

  useEffect(() => {
    historyRef.current = createCombatMapHistory(mapRef.current.svg);
  }, [map.id]);

  useEffect(() => {
    const current = mapRef.current;
    const next = ensureCombatMapMetersPerUnit(current.svg);
    if (next !== current.svg) {
      onMapChange({ ...current, svg: next });
      historyRef.current = createCombatMapHistory(next);
    }
  }, [map.id, onMapChange]);

  const prevSelectionKeyRef = useRef("");
  const selectionKey = selectedIds.join("\0");
  useEffect(() => {
    if (layout !== "edit") return;
    if (selectedIds.length > 0 && selectionKey !== prevSelectionKeyRef.current) {
      setTool("select");
    }
    prevSelectionKeyRef.current = selectionKey;
  }, [layout, selectedIds.length, selectionKey]);

  useEffect(() => {
    hideRotateCursor();
  }, [selectedIds, tool, layout]);

  useEffect(() => {
    const next = ensureCombatMapElementIds(map.svg);
    if (next !== map.svg) {
      onMapChange({ ...map, svg: next });
      historyRef.current = createCombatMapHistory(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- map.svg intentionally omitted
  }, [map.id, onMapChange]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    function syncViewportSize() {
      const { width, height } = viewport!.getBoundingClientRect();
      if (width >= 1 && height >= 1) setViewportSize({ width, height });
    }

    syncViewportSize();
    const sizeObserver = new ResizeObserver(syncViewportSize);
    sizeObserver.observe(viewport);
    return () => sizeObserver.disconnect();
  }, [layout, map.id]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !artboard) return;

    function applyFit() {
      if (viewportFittedRef.current || !viewport || !artboard) return;
      const rect = viewport.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      const insets = layout === "edit" ? COMBAT_MAP_EDIT_UI_INSETS : COMBAT_MAP_PLAY_UI_INSETS;
      const { pan: nextPan, scale: nextScale } = fitCombatMapArtboard(artboard, rect, insets);
      viewportFittedRef.current = true;
      setPan(nextPan);
      setScale(nextScale);
    }

    applyFit();
    const observer = new ResizeObserver(applyFit);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [artboard, layout, map.id]);

  function mapPointAtClient(clientX: number, clientY: number) {
    const viewport = viewportRef.current;
    const vb = parseSvgViewBox(mapRef.current.svg);
    if (!viewport || !vb) return null;
    const local = clientToMapPoint(
      clientX,
      clientY,
      viewport.getBoundingClientRect(),
      panRef.current,
      scaleRef.current,
    );
    return { x: local.x + vb.x, y: local.y + vb.y };
  }

  const centerViewOnPoint = useCallback((svgX: number, svgY: number) => {
    const viewport = viewportRef.current;
    const vb = parseSvgViewBox(mapRef.current.svg);
    if (!viewport || !vb) return;
    setPan(
      centerPanOnSvgPoint(
        svgX - vb.x,
        svgY - vb.y,
        viewport.getBoundingClientRect(),
        panRef.current,
        scaleRef.current,
      ),
    );
  }, []);

  const previewElementPatch = useCallback((id: string, patch: Record<string, string>) => {
    if (patch.fill === undefined && patch.stroke === undefined) return;
    const { mapRoot, overlayRoot } = mapPreviewRoots();
    previewMapStyle(mapRoot, overlayRoot, id, patch, mapRef.current.svg);
  }, []);

  const patchElement = useCallback(
    (id: string, patch: Record<string, string>) => {
      const { svg: nextSvg, id: nextId } = combatMapElementIdAfterUpdate(map.svg, id, patch);
      changeMapSvg(nextSvg);
      if (nextId !== id && selectedIdsRef.current.includes(id)) {
        onSelectIds(selectedIdsRef.current.map((entry) => (entry === id ? nextId : entry)));
      }
    },
    [changeMapSvg, map.svg, onSelectIds],
  );

  const patchElements = useCallback(
    (ids: readonly string[], patch: Record<string, string>) => {
      let svg = map.svg;
      let nextIds = [...selectedIdsRef.current];
      for (const id of ids) {
        const result = combatMapElementIdAfterUpdate(svg, id, patch);
        svg = result.svg;
        if (result.id !== id) {
          nextIds = nextIds.map((entry) => (entry === id ? result.id : entry));
        }
      }
      changeMapSvg(svg);
      if (nextIds.join("\0") !== selectedIdsRef.current.join("\0")) onSelectIds(nextIds);
    },
    [changeMapSvg, map.svg, onSelectIds],
  );

  const previewElementsPatch = useCallback(
    (ids: readonly string[], patch: Record<string, string>) => {
      for (const id of ids) previewElementPatch(id, patch);
    },
    [previewElementPatch],
  );

  const patchMany = useCallback(
    (patch: Record<string, string>) => {
      patchElements(selectedIdsRef.current, patch);
    },
    [patchElements],
  );

  const previewMany = useCallback(
    (patch: Record<string, string>) => {
      previewElementsPatch(selectedIdsRef.current, patch);
    },
    [previewElementsPatch],
  );

  const deleteElement = useCallback(
    (id: string) => {
      const el = parseCombatMapElements(map.svg).find((e) => e.id === id);
      if (!el || !canDeleteCombatMapElement(el)) return;
      const svg = removeCombatMapElement(map.svg, id);
      historyRef.current = pushCombatMapHistory(historyRef.current, svg);
      touchMap({
        svg,
        layerGroups: pruneCombatMapLayerGroups(
          svg,
          removeCombatMapLayerFromGroups(map.layerGroups, id),
        ),
      });
      onSelectIds(selectedIds.filter((entry) => entry !== id));
      setContextMenu(null);
    },
    [map.layerGroups, map.svg, onSelectIds, selectedIds, touchMap],
  );

  const deleteSelectedElements = useCallback(() => {
    let svg = map.svg;
    let layerGroups = map.layerGroups ?? [];
    let removed = false;
    for (const id of selectedIds) {
      const el = parseCombatMapElements(svg).find((entry) => entry.id === id);
      if (!el || !canDeleteCombatMapElement(el)) continue;
      svg = removeCombatMapElement(svg, id);
      layerGroups = removeCombatMapLayerFromGroups(layerGroups, id);
      removed = true;
    }
    if (!removed) return;
    historyRef.current = pushCombatMapHistory(historyRef.current, svg);
    touchMap({ svg, layerGroups: pruneCombatMapLayerGroups(svg, layerGroups) });
    onSelectIds([]);
    setContextMenu(null);
  }, [map.layerGroups, map.svg, onSelectIds, selectedIds, touchMap]);

  const addRect = useCallback(
    (kind: InsertRectOptions["kind"], x: number, y: number, width: number, height: number) => {
      const prefix =
        kind === "barrier" ? "wall" : kind === "concealment" ? "cover" : kind === "room" ? "room" : "bounds";
      const id = kind === "bounding_box" ? "bounds" : newCombatMapElementId();
      const name = nextElementDisplayName(map.svg, prefix);
      let svg = map.svg;
      if (kind === "bounding_box") {
        const existing = boundingBoxElement(map.svg);
        if (existing) {
          svg = updateCombatMapElement(map.svg, existing.id, {
            x: String(x),
            y: String(y),
            width: String(width),
            height: String(height),
          });
        } else {
          svg = insertCombatMapRect(map.svg, { kind, id, name, x, y, width, height });
        }
      } else {
        svg = insertCombatMapRect(map.svg, { kind, id, name, x, y, width, height });
      }
      changeMapSvg(svg);
      onSelectIds([kind === "bounding_box" ? (boundingBoxElement(svg)?.id ?? "bounds") : id]);
    },
    [changeMapSvg, map.svg, onSelectIds],
  );

  useEffect(() => {
    const root = canvasRef.current;
    if (!root || layout !== "edit") return;
    const svg = root.querySelector("svg");
    if (!svg) return;

    function resolveShapeId(target: Element | null): string | null {
      const shape = closestCombatMapSelectableShape(target);
      if (!shape) return null;
      return combatMapElementIdFromDom(shape, mapRef.current.svg);
    }

    function onDoubleClick(event: MouseEvent) {
      if (isCombatDrawTool(toolRef.current)) return;
      const id = resolveShapeId(event.target as Element | null);
      if (!id) return;
      const el = parseCombatMapElements(mapRef.current.svg).find((e) => e.id === id);
      const center = el ? combatMapElementCenter(el) : null;
      if (center) centerViewOnPoint(center.x, center.y);
      onSelectIds([id]);
      event.preventDefault();
      event.stopPropagation();
    }

    function onContextMenu(event: MouseEvent) {
      if (isCombatDrawTool(toolRef.current)) return;
      const id = resolveShapeId(event.target as Element | null);
      if (!id) return;
      const el = parseCombatMapElements(mapRef.current.svg).find((e) => e.id === id);
      if (!el || !canDeleteCombatMapElement(el)) return;
      event.preventDefault();
      onSelectIds([id]);
      setContextMenu({ x: event.clientX, y: event.clientY, id });
    }

    for (const node of svg.querySelectorAll(COMBAT_MAP_SELECTABLE_SHAPE_SELECTOR)) {
      node.addEventListener("dblclick", onDoubleClick as EventListener);
      node.addEventListener("contextmenu", onContextMenu as EventListener);
    }
    return () => {
      for (const node of svg.querySelectorAll(COMBAT_MAP_SELECTABLE_SHAPE_SELECTOR)) {
        node.removeEventListener("dblclick", onDoubleClick as EventListener);
        node.removeEventListener("contextmenu", onContextMenu as EventListener);
      }
    };
  }, [centerViewOnPoint, displaySvg, layout, onSelectIds]);

  useEffect(() => {
    if (layout !== "edit") return;

    function clearSpacePan() {
      spacePanRef.current = false;
      setSpacePanHeld(false);
      const restore = spacePanRestoreToolRef.current;
      spacePanRestoreToolRef.current = null;
      if (restore) setTool(restore);
    }

    function onKeyDown(event: KeyboardEvent) {
      const typing = isCombatMapTypingTarget(event.target);
      if (isSpacePanKeyDown(event, typing)) {
        event.preventDefault();
        if (!spacePanRef.current && isCombatDrawTool(toolRef.current)) {
          spacePanRestoreToolRef.current = toolRef.current;
          setTool("select");
        }
        drawDragRef.current = null;
        setDrawPreview(null);
        setSnapGuides([]);
        spacePanRef.current = true;
        setSpacePanHeld(true);
        return;
      }

      const clipboardKey = isCombatMapClipboardKeyDown(event, typing);
      if (clipboardKey === "copy") {
        const copyId = primarySelectionId(selectedIdsRef.current) ?? "";
        const text = copyCombatMapElementFromSvg(mapRef.current.svg, copyId);
        if (!text) return;
        event.preventDefault();
        svgClipboardRef.current = text;
        void navigator.clipboard.writeText(text).catch(() => {});
        return;
      }
      if (clipboardKey === "paste") {
        event.preventDefault();
        void (async () => {
          let text = svgClipboardRef.current ?? "";
          try {
            const clip = await navigator.clipboard.readText();
            if (clip.trim()) text = clip;
          } catch {
            // ponytail: fall back to in-memory svg snippet from last copy
          }
          const pasted = pasteCombatMapElement(mapRef.current.svg, text);
          if (!pasted) return;
          changeMapSvg(pasted.svg);
          onSelectIds([pasted.id]);
          setTool("select");
        })();
        return;
      }

      if (isCombatMapHelpKeyDown(event, typing)) {
        event.preventDefault();
        setHelpOpen(true);
        return;
      }

      const undoKey = isCombatMapUndoKeyDown(event, typing);
      if (undoKey === "undo") {
        event.preventDefault();
        undoMap();
        return;
      }
      if (undoKey === "redo") {
        event.preventDefault();
        redoMap();
        return;
      }

      if (isCombatMapEscapeKeyDown(event, typing) && isCombatDrawTool(toolRef.current)) {
        event.preventDefault();
        drawDragRef.current = null;
        setDrawPreview(null);
        setSnapGuides([]);
        setTool("select");
        return;
      }

      if (isCombatMapGroupKeyDown(event, typing)) {
        event.preventDefault();
        const created = createLayerGroupFromSelection(
          mapRef.current.layerGroups ?? [],
          selectedIdsRef.current,
          parseCombatMapElements(mapRef.current.svg),
        );
        if (created) touchMap({ layerGroups: created.groups });
        return;
      }

      if (isCombatMapUngroupKeyDown(event, typing)) {
        event.preventDefault();
        touchMap({
          layerGroups: ungroupSelectedLayers(mapRef.current.layerGroups ?? [], selectedIdsRef.current),
        });
        return;
      }

      if (event.key !== "Delete" && event.key !== "Backspace") return;
      if (typing) return;
      if (selectedIdsRef.current.length === 0) return;
      event.preventDefault();
      deleteSelectedElements();
    }

    function onKeyUp(event: KeyboardEvent) {
      if (event.code === "Space") clearSpacePan();
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", clearSpacePan);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", clearSpacePan);
    };
  }, [changeMapSvg, deleteSelectedElements, layout, onSelectIds, redoMap, touchMap, selectedIds.length, undoMap]);

  useEffect(() => {
    if (!contextMenu) return;
    function dismiss(event: Event) {
      if ((event.target as Element | null)?.closest("[data-combat-context-menu]")) return;
      setContextMenu(null);
    }
    window.addEventListener("pointerdown", dismiss);
    window.addEventListener("scroll", dismiss, true);
    return () => {
      window.removeEventListener("pointerdown", dismiss);
      window.removeEventListener("scroll", dismiss, true);
    };
  }, [contextMenu]);

  useEffect(() => {
    const root = canvasRef.current;
    if (!root) return;
    for (const node of root.querySelectorAll("[name]")) {
      node.removeAttribute("data-selected");
    }
    for (const id of selectedIds) {
      const el = parseCombatMapElements(mapRef.current.svg).find((entry) => entry.id === id);
      const node =
        el?.kind === "bounding_box"
          ? root.querySelector('rect[type="bounding_box"]')
          : root.querySelector(`[name="${id}"]`);
      node?.setAttribute("data-selected", "true");
    }
  }, [displaySvg, selectedIds]);

  function beginDrawDrag(event: React.PointerEvent) {
    event.stopPropagation();
    const pt = mapPointAtClient(event.clientX, event.clientY);
    if (!pt) return;
    drawDragRef.current = {
      pointerId: event.pointerId,
      start: pt,
      current: pt,
      bounds: { x: pt.x, y: pt.y, width: 0, height: 0 },
      startClientX: event.clientX,
      startClientY: event.clientY,
    };
    setDrawPreview({ x: pt.x, y: pt.y, width: 0, height: 0 });
    viewportRef.current?.setPointerCapture(event.pointerId);
  }

  function onViewportPointerDownCapture(event: React.PointerEvent) {
    if (event.button !== 0 || layout !== "edit" || spacePanRef.current) return;
    const target = event.target as HTMLElement;
    if (target.closest("[data-scale-handle],[data-vertex-handle]")) return;
    if (combatMapNpcTokenIdFromDom(target, mapRef.current.svg)) return;
    if (!isCombatDrawTool(toolRef.current)) return;
    beginDrawDrag(event);
  }

  function onViewportPointerDown(event: React.PointerEvent) {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;

    if (layout === "play") return;

    if (spacePanRef.current) {
      panDragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originPanX: pan.x,
        originPanY: pan.y,
        moved: false,
      };
      viewportRef.current?.setPointerCapture(event.pointerId);
      return;
    }

    const npcTokenId = combatMapNpcTokenIdFromDom(target, mapRef.current.svg);
    if (layout === "edit" && npcTokenId && tool !== "select") {
      event.stopPropagation();
      const additive = event.shiftKey || event.metaKey || event.ctrlKey;
      onSelectIds(selectIdsForPointerDown(selectedIdsRef.current, npcTokenId, additive));
      return;
    }

    const pt = mapPointAtClient(event.clientX, event.clientY);
    const isGroupSelection = transformIds.length > 1 && !!groupSelectionBounds;

    if (layout === "edit" && tool === "select" && pt) {
      if (isGroupSelection && groupSelectionBounds) {
        const groupCornerHit = pickGroupCornerInteraction(groupSelectionBounds, pt, scaleRef.current);
        if (groupCornerHit?.kind === "rotate") {
          event.stopPropagation();
          rotateDragRef.current = {
            pointerId: event.pointerId,
            ids: transformIds,
            originSvg: mapRef.current.svg,
            originDeg: 0,
            startPointerDeg: pointerAngleDeg(
              groupSelectionBounds.x + groupSelectionBounds.width / 2,
              groupSelectionBounds.y + groupSelectionBounds.height / 2,
              pt.x,
              pt.y,
            ),
            pivot: {
              x: groupSelectionBounds.x + groupSelectionBounds.width / 2,
              y: groupSelectionBounds.y + groupSelectionBounds.height / 2,
            },
            groupRotate: true,
          };
          showRotateCursor(event.clientX, event.clientY);
          viewportRef.current?.setPointerCapture(event.pointerId);
          return;
        }
      } else if (primaryId && selected?.tag === "rect") {
        const cornerHit = pickRectCornerInteraction(selected, pt, scaleRef.current);
        if (cornerHit?.kind === "rotate") {
          const bounds = rectLocalBounds(selected);
          if (!bounds) return;
          const pivot = rectRotationCenter(bounds, rectElementRotation(selected));
          event.stopPropagation();
          rotateDragRef.current = {
            pointerId: event.pointerId,
            ids: [primaryId],
            originSvg: mapRef.current.svg,
            originDeg: rectElementRotation(selected)?.deg ?? 0,
            startPointerDeg: pointerAngleDeg(pivot.cx, pivot.cy, pt.x, pt.y),
            pivot: { x: pivot.cx, y: pivot.cy },
            groupRotate: false,
          };
          showRotateCursor(event.clientX, event.clientY);
          viewportRef.current?.setPointerCapture(event.pointerId);
          return;
        }
      }
    }

    const scaleHandle = target.closest("[data-scale-handle]");
    if (scaleHandle && layout === "edit" && tool === "select") {
      const handle = scaleHandle.getAttribute("data-scale-handle") as ScaleHandleId;
      if (!SCALE_HANDLE_IDS.includes(handle)) return;
      event.stopPropagation();
      if (isGroupSelection && groupSelectionBounds) {
        scaleDragRef.current = {
          pointerId: event.pointerId,
          ids: transformIds,
          handle,
          originSvg: mapRef.current.svg,
          originBounds: groupSelectionBounds,
        };
      } else if (primaryId && selected?.tag === "rect") {
        const originBounds = combatMapElementBounds(selected) ?? rectLocalBounds(selected);
        if (!originBounds) return;
        scaleDragRef.current = {
          pointerId: event.pointerId,
          ids: [primaryId],
          handle,
          originSvg: mapRef.current.svg,
          originBounds,
        };
      } else {
        return;
      }
      viewportRef.current?.setPointerCapture(event.pointerId);
      return;
    }

    const vertexHandle = target.closest("[data-vertex-handle]");
    if (vertexHandle && primaryId && tool === "select" && selectedIds.length === 1) {
      const index = Number(vertexHandle.getAttribute("data-vertex-index"));
      if (!Number.isFinite(index)) return;
      event.stopPropagation();
      vertexDragRef.current = {
        pointerId: event.pointerId,
        id: primaryId,
        index,
        pendingSvg: mapRef.current.svg,
      };
      viewportRef.current?.setPointerCapture(event.pointerId);
      return;
    }

    if (tool === "select") {
      if (
        pt &&
        isMarqueeSelectModifier(event) &&
        !closestCombatMapSelectableShape(target) &&
        !target.closest("[data-scale-handle],[data-vertex-handle]")
      ) {
        event.stopPropagation();
        marqueeDragRef.current = {
          pointerId: event.pointerId,
          start: pt,
          originIds: [...selectedIdsRef.current],
          additive: event.shiftKey,
        };
        setMarqueePreview({ x: pt.x, y: pt.y, width: 0, height: 0 });
        viewportRef.current?.setPointerCapture(event.pointerId);
        return;
      }

      if (
        isGroupSelection &&
        groupSelectionBounds &&
        pt &&
        pointInBounds(pt, groupSelectionBounds) &&
        !closestCombatMapSelectableShape(target)
      ) {
        const groupCornerHit = pickGroupCornerInteraction(groupSelectionBounds, pt, scaleRef.current);
        if (!groupCornerHit) {
          event.stopPropagation();
          elementDragRef.current = {
            pointerId: event.pointerId,
            dragId: primaryId ?? transformIds[0]!,
            moveIds: transformIds,
            startClientX: event.clientX,
            startClientY: event.clientY,
            originSvg: mapRef.current.svg,
            moved: false,
          };
          viewportRef.current?.setPointerCapture(event.pointerId);
          return;
        }
      }

      const shape = closestCombatMapSelectableShape(target);
      if (shape) {
        const id = combatMapElementIdFromDom(shape, mapRef.current.svg);
        if (!id) return;
        const el = parseCombatMapElements(mapRef.current.svg).find((e) => e.id === id);
        if (el?.kind === "bounding_box") return;
        event.stopPropagation();
        const additive = event.shiftKey || event.metaKey || event.ctrlKey;
        const nextIds = selectIdsForPointerDown(selectedIdsRef.current, id, additive);
        onSelectIds(nextIds);
        elementDragRef.current = {
          pointerId: event.pointerId,
          dragId: id,
          moveIds: nextIds,
          startClientX: event.clientX,
          startClientY: event.clientY,
          originSvg: mapRef.current.svg,
          moved: false,
        };
        viewportRef.current?.setPointerCapture(event.pointerId);
        return;
      }
      if (pt && artboard) {
        const oobHit = hitOutOfBoundsElementAtPoint(
          parseCombatMapElements(mapRef.current.svg),
          pt,
          artboard,
        );
        if (oobHit) {
          event.stopPropagation();
          const additive = event.shiftKey || event.metaKey || event.ctrlKey;
          const nextIds = selectIdsForPointerDown(selectedIdsRef.current, oobHit.id, additive);
          onSelectIds(nextIds);
          elementDragRef.current = {
            pointerId: event.pointerId,
            dragId: oobHit.id,
            moveIds: nextIds,
            startClientX: event.clientX,
            startClientY: event.clientY,
            originSvg: mapRef.current.svg,
            moved: false,
          };
          viewportRef.current?.setPointerCapture(event.pointerId);
          return;
        }
      }
      const bounds = boundingBoxElement(mapRef.current.svg);
      const insideBounds =
        bounds && pt
          ? (() => {
              const x = Number(bounds.attrs.x ?? 0);
              const y = Number(bounds.attrs.y ?? 0);
              const w = Number(bounds.attrs.width ?? 0);
              const h = Number(bounds.attrs.height ?? 0);
              return pt.x >= x && pt.x <= x + w && pt.y >= y && pt.y <= y + h;
            })()
          : false;
      if (
        bounds &&
        insideBounds &&
        selectedIdsRef.current.length === 1 &&
        selectedIdsRef.current[0] === bounds.id
      ) {
        event.stopPropagation();
        elementDragRef.current = {
          pointerId: event.pointerId,
          dragId: bounds.id,
          moveIds: [bounds.id],
          startClientX: event.clientX,
          startClientY: event.clientY,
          originSvg: mapRef.current.svg,
          moved: false,
        };
        viewportRef.current?.setPointerCapture(event.pointerId);
        return;
      }
      const tapSelectId =
        insideBounds && bounds && transformIds.length === 0 ? bounds.id : undefined;
      if (!(isGroupSelection && groupSelectionBounds && pt && pointInBounds(pt, groupSelectionBounds))) {
        onSelectIds([]);
      }
      panDragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originPanX: pan.x,
        originPanY: pan.y,
        moved: false,
        tapSelectId,
      };
      viewportRef.current?.setPointerCapture(event.pointerId);
      return;
    }

    if (tool === "npc") return;

    if (drawToolActive) {
      if (!drawDragRef.current) beginDrawDrag(event);
      return;
    }
  }

  function onViewportPointerMove(event: React.PointerEvent) {
    const marqueeDrag = marqueeDragRef.current;
    if (marqueeDrag && marqueeDrag.pointerId === event.pointerId) {
      const pt = mapPointAtClient(event.clientX, event.clientY);
      if (!pt) return;
      setMarqueePreview(boundsFromTwoPoints(marqueeDrag.start.x, marqueeDrag.start.y, pt.x, pt.y));
      return;
    }

    const panDrag = panDragRef.current;
    if (panDrag && panDrag.pointerId === event.pointerId) {
      const dx = event.clientX - panDrag.startX;
      const dy = event.clientY - panDrag.startY;
      if (Math.hypot(dx, dy) > 4) {
        panDrag.moved = true;
        setIsPanning(true);
      }
      setPan({ x: panDrag.originPanX + dx, y: panDrag.originPanY + dy });
      return;
    }

    const snapThreshold = snapThresholdMapUnits(scaleRef.current);

    const rotateDrag = rotateDragRef.current;
    if (rotateDrag && rotateDrag.pointerId === event.pointerId) {
      const pt = mapPointAtClient(event.clientX, event.clientY);
      if (!pt) return;
      showRotateCursor(event.clientX, event.clientY);
      const pointerDeg = pointerAngleDeg(rotateDrag.pivot.x, rotateDrag.pivot.y, pt.x, pt.y);
      if (rotateDrag.groupRotate) {
        const delta = rotationDragDegrees(
          0,
          rotateDrag.startPointerDeg,
          pointerDeg,
          event.shiftKey,
        );
        rotateDrag.pendingSvg = rotateCombatMapSelection(
          rotateDrag.originSvg,
          rotateDrag.ids,
          rotateDrag.pivot,
          delta,
        );
        previewSvgElementDiff(rotateDrag.originSvg, rotateDrag.pendingSvg, rotateDrag.ids);
      } else {
        const rotateId = rotateDrag.ids[0];
        if (!rotateId) return;
        const originEl = parseCombatMapElements(rotateDrag.originSvg).find((e) => e.id === rotateId);
        if (!originEl) return;
        const nextDeg = rotationDragDegrees(
          rotateDrag.originDeg,
          rotateDrag.startPointerDeg,
          pointerDeg,
          event.shiftKey,
        );
        const rotationPatch = patchRectRotation(originEl, nextDeg);
        rotateDrag.pendingSvg = updateCombatMapElementRotation(rotateDrag.originSvg, rotateId, nextDeg);
        const { mapRoot, overlayRoot } = mapPreviewRoots();
        previewMapRect(mapRoot, overlayRoot, rotateId, {
          transform: rotationPatch.transform === undefined ? null : rotationPatch.transform ?? null,
        });
        const previewAttrs = { ...originEl.attrs };
        if (rotationPatch.transform) previewAttrs.transform = rotationPatch.transform;
        else delete previewAttrs.transform;
        previewSelectionOutline(rotateId, { ...originEl, attrs: previewAttrs });
      }
      return;
    }

    const scaleDrag = scaleDragRef.current;
    if (scaleDrag && scaleDrag.pointerId === event.pointerId) {
      const pt = mapPointAtClient(event.clientX, event.clientY);
      if (!pt) return;
      const scaleId = scaleDrag.ids[0];
      const scaledEl = scaleId
        ? parseCombatMapElements(scaleDrag.originSvg).find((e) => e.id === scaleId)
        : null;
      const targets = collectSnapTargets(scaleDrag.originSvg, scaleId);
      const grid = gridSnapEnabledForElementKind(scaledEl?.kind) ? gridSnapRef.current : null;
      const snapped = snapPoint(pt.x, pt.y, targets, snapThreshold, grid);
      setSnapGuides(snapped.guides);
      const mpu = combatMapMetersPerUnit(scaleDrag.originSvg);
      const minSize = minCombatDrawRectSizeSvg(mpu, "barrier");
      const nextSvg =
        scaleDrag.ids.length > 1
          ? resizeCombatMapSelection(
              scaleDrag.originSvg,
              scaleDrag.ids,
              scaleDrag.originBounds,
              scaleDrag.handle,
              snapped,
              minSize,
            )
          : scaledEl && rectElementIsRotated(scaledEl)
            ? resizeCombatMapRectIgnoringRotation(
                scaleDrag.originSvg,
                scaleDrag.ids[0]!,
                scaleDrag.originBounds,
                scaleDrag.handle,
                snapped,
                minSize,
              )
            : (() => {
                const resizeKind =
                  scaledEl?.kind === "room" || scaledEl?.kind === "bounding_box" ? "room" : "barrier";
                const nextBounds = boundsFromHandleDrag(
                  scaleDrag.originBounds,
                  scaleDrag.handle,
                  snapped,
                  minCombatDrawRectSizeSvg(mpu, resizeKind),
                );
                return resizeCombatMapElement(scaleDrag.originSvg, scaleDrag.ids[0]!, nextBounds);
              })();
      scaleDrag.pendingSvg = nextSvg;
      previewSvgElementDiff(scaleDrag.originSvg, nextSvg, scaleDrag.ids);
      return;
    }

    const elementDrag = elementDragRef.current;
    if (elementDrag && elementDrag.pointerId === event.pointerId) {
      const { dx, dy } = mapDeltaFromClientDrag(
        event.clientX,
        event.clientY,
        elementDrag.startClientX,
        elementDrag.startClientY,
        scaleRef.current,
      );
      if (!elementDrag.moved && Math.hypot(dx * scaleRef.current, dy * scaleRef.current) <= 4) return;
      elementDrag.moved = true;
      setDraggingElementId(elementDrag.dragId);
      const dragged = parseCombatMapElements(elementDrag.originSvg).find((e) => e.id === elementDrag.dragId);
      const originBounds = dragged ? combatMapElementBounds(dragged) : null;
      let nextDx = dx;
      let nextDy = dy;
      if (originBounds) {
        const targets = collectSnapTargets(elementDrag.originSvg, elementDrag.dragId);
        const snapped = snapMoveDelta(originBounds, dx, dy, targets, snapThreshold, gridSnapRef.current);
        nextDx = snapped.dx;
        nextDy = snapped.dy;
        setSnapGuides(snapped.guides);
      } else {
        setSnapGuides([]);
      }
      const nextSvg = moveCombatMapSelection(
        elementDrag.originSvg,
        elementDrag.moveIds,
        elementDrag.dragId,
        nextDx,
        nextDy,
      );
      elementDrag.pendingSvg = nextSvg;
      previewSvgElementDiff(elementDrag.originSvg, nextSvg, elementDrag.moveIds);
      return;
    }

    const drawDrag = drawDragRef.current;
    if (drawDrag && drawDrag.pointerId === event.pointerId) {
      const pt = mapPointFromClientDrag(
        drawDrag.start,
        event.clientX,
        event.clientY,
        drawDrag.startClientX,
        drawDrag.startClientY,
        scaleRef.current,
      );
      const drawKind = toolRef.current;
      const targets =
        drawKind === "barrier" || drawKind === "concealment"
          ? { xs: [], ys: [] }
          : collectSnapTargets(mapRef.current.svg);
      const snapped = snapDrawRectFromAnchor(drawDrag.start, pt, targets, snapThreshold);
      drawDrag.current = snapped.corner;
      drawDrag.bounds = snapped.bounds;
      setSnapGuides(snapped.guides);
      setDrawPreview({
        x: snapped.bounds.x,
        y: snapped.bounds.y,
        width: snapped.bounds.width,
        height: snapped.bounds.height,
      });
      return;
    }

    const vertexDrag = vertexDragRef.current;
    if (vertexDrag && vertexDrag.pointerId === event.pointerId) {
      const pt = mapPointAtClient(event.clientX, event.clientY);
      if (!pt) return;
      const vertexEl = parseCombatMapElements(mapRef.current.svg).find((e) => e.id === vertexDrag.id);
      const targets = collectSnapTargets(mapRef.current.svg, vertexDrag.id);
      const grid = gridSnapEnabledForElementKind(vertexEl?.kind) ? gridSnapRef.current : null;
      const snapped = snapPoint(pt.x, pt.y, targets, snapThreshold, grid);
      setSnapGuides(snapped.guides);
      const baseSvg = vertexDrag.pendingSvg ?? mapRef.current.svg;
      const nextSvg = updateCombatMapPathVertex(
        baseSvg,
        vertexDrag.id,
        vertexDrag.index,
        snapped.x,
        snapped.y,
      );
      vertexDrag.pendingSvg = nextSvg;
      previewSvgElementDiff(baseSvg, nextSvg, [vertexDrag.id]);
      return;
    }

    if (
      layout === "edit" &&
      toolRef.current === "select" &&
      transformableSelectionIds(
        parseCombatMapElements(mapRef.current.svg),
        selectedIdsRef.current,
      ).length > 0 &&
      !panDragRef.current &&
      !elementDragRef.current &&
      !scaleDragRef.current &&
      !rotateDragRef.current &&
      !drawDragRef.current &&
      !vertexDragRef.current
    ) {
      const pt = mapPointAtClient(event.clientX, event.clientY);
      if (!pt) {
        hideRotateCursor();
        return;
      }
      const hoverElements = parseCombatMapElements(mapRef.current.svg);
      const hoverTransformIds = transformableSelectionIds(hoverElements, selectedIdsRef.current);
      const hoverGroupBounds =
        hoverTransformIds.length > 1
          ? selectionGroupBounds(hoverElements, selectedIdsRef.current)
          : null;
      if (hoverGroupBounds) {
        const hit = pickGroupCornerInteraction(hoverGroupBounds, pt, scaleRef.current);
        if (hit?.kind === "rotate") showRotateCursor(event.clientX, event.clientY);
        else hideRotateCursor();
        return;
      }
      const el = hoverElements.find((entry) => entry.id === selectedIdsRef.current[0]);
      if (el && el.tag === "rect") {
        const hit = pickRectCornerInteraction(el, pt, scaleRef.current);
        if (hit?.kind === "rotate") showRotateCursor(event.clientX, event.clientY);
        else hideRotateCursor();
      } else {
        hideRotateCursor();
      }
    }

    if (layout === "edit" && artboard) {
      const pt = mapPointAtClient(event.clientX, event.clientY);
      if (!pt) {
        setHoverOobElementId(null);
      } else {
        const hit = hitOutOfBoundsElementAtPoint(parseCombatMapElements(mapRef.current.svg), pt, artboard);
        setHoverOobElementId(hit?.id ?? null);
      }
    }
  }

  function onViewportPointerUp(event: React.PointerEvent) {
    const drawDrag = drawDragRef.current;
    if (drawDrag && drawDrag.pointerId === event.pointerId) {
      const { bounds } = drawDrag;
      drawDragRef.current = null;
      setDrawPreview(null);
      const activeTool = toolRef.current;
      const mpu = combatMapMetersPerUnit(mapRef.current.svg);
      if (
        isCombatDrawTool(activeTool) &&
        isCombatDrawRectLargeEnough(bounds.width, bounds.height, mpu, activeTool)
      ) {
        addRect(activeTool, bounds.x, bounds.y, bounds.width, bounds.height);
      }
    }

    const marqueeDrag = marqueeDragRef.current;
    if (marqueeDrag?.pointerId === event.pointerId) {
      const pt = mapPointAtClient(event.clientX, event.clientY);
      marqueeDragRef.current = null;
      setMarqueePreview(null);
      if (pt) {
        const rect = boundsFromTwoPoints(marqueeDrag.start.x, marqueeDrag.start.y, pt.x, pt.y);
        const minSize = 4 / Math.max(scaleRef.current, 1e-9);
        onSelectIds(
          selectIdsInMarquee(
            parseCombatMapElements(mapRef.current.svg),
            rect,
            marqueeDrag.originIds,
            marqueeDrag.additive,
            minSize,
          ),
        );
      }
    }

    const panDrag = panDragRef.current;
    if (panDrag?.pointerId === event.pointerId) {
      if (panDrag.playTap) {
        const next = resolvePlayModeTapSelection(panDrag.moved, panDrag.tapSelectId);
        if (next) onSelectIds(next);
      } else if (!panDrag.moved && panDrag.tapSelectId) {
        onSelectIds([panDrag.tapSelectId]);
      }
      panDragRef.current = null;
    }
    const elementDrag = elementDragRef.current;
    if (elementDrag?.pointerId === event.pointerId) {
      commitPendingDragSvg(elementDrag.pendingSvg);
      elementDragRef.current = null;
    }
    const vertexDrag = vertexDragRef.current;
    if (vertexDrag?.pointerId === event.pointerId) {
      commitPendingDragSvg(vertexDrag.pendingSvg);
      vertexDragRef.current = null;
    }
    const scaleDrag = scaleDragRef.current;
    if (scaleDrag?.pointerId === event.pointerId) {
      commitPendingDragSvg(scaleDrag.pendingSvg);
      scaleDragRef.current = null;
    }
    const rotateDrag = rotateDragRef.current;
    if (rotateDrag?.pointerId === event.pointerId) {
      commitPendingDragSvg(rotateDrag.pendingSvg);
      rotateDragRef.current = null;
      hideRotateCursor();
    }
    setSnapGuides([]);
    setIsPanning(false);
    setDraggingElementId(null);
    viewportRef.current?.releasePointerCapture(event.pointerId);
  }

  function onViewportWheel(event: React.WheelEvent) {
    if (layout === "play") return;
    event.preventDefault();
    const viewport = viewportRef.current;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    const factor = Math.exp(-event.deltaY * 0.002);
    const nextScale = Math.min(MAX_SCALE, Math.max(0.02, scaleRef.current * factor));
    const localX = (event.clientX - rect.left - panRef.current.x) / scaleRef.current;
    const localY = (event.clientY - rect.top - panRef.current.y) / scaleRef.current;
    setPan({
      x: event.clientX - rect.left - localX * nextScale,
      y: event.clientY - rect.top - localY * nextScale,
    });
    setScale(nextScale);
  }

  function placeNpcAtCenter(sheetId: string) {
    const bounds = boundingBoxElement(map.svg);
    const cx = bounds ? Number(bounds.attrs.x ?? 0) + Number(bounds.attrs.width ?? 400) / 2 : 400;
    const cy = bounds ? Number(bounds.attrs.y ?? 0) + Number(bounds.attrs.height ?? 300) / 2 : 250;
    const id = newCombatMapElementId();
    const name = nextElementDisplayName(map.svg, "npc");
    changeMapSvg(insertNpcToken(map.svg, { id, name, sheetId, cx, cy }));
    onSelectIds([id]);
    setNpcModalOpen(false);
    setPendingNpcSheetId(null);
    setTool("select");
  }

  function handleExportMap() {
    download(exportCombatMapFilename(map), serializeCombatMapExport(map), "application/json");
  }

  async function handleImportFile(file: File) {
    const result = await importMapFromText(await file.text());
    if (!result.ok) {
      setImportFailure(result);
      return;
    }
    router.push(`/combat/${result.map.id}`);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onSave();
    } finally {
      setSaving(false);
    }
  }

  const showPlayPanel = layout === "play";

  const viewportCursor =
    layout === "play"
      ? isPanning || draggingElementId
        ? "grabbing"
        : "grab"
      : spacePanHeld
            ? isPanning
              ? "grabbing"
              : "grab"
            : tool !== "select" && tool !== "npc"
              ? "crosshair"
              : isPanning || draggingElementId
                ? "grabbing"
                : "grab";

  const tools: { id: CombatEditorTool; label: string; icon: typeof Hand }[] = [
    { id: "select", label: t("combat.editor.tool.select"), icon: Hand },
    { id: "npc", label: t("combat.editor.tool.npc"), icon: UserPlus },
    { id: "concealment", label: t("combat.editor.tool.cover"), icon: Shield },
    { id: "barrier", label: t("combat.editor.tool.wall"), icon: Square },
    { id: "room", label: t("combat.editor.tool.room"), icon: DoorOpen },
    { id: "bounding_box", label: t("combat.editor.tool.bounds"), icon: BoxSelect },
  ];

  if (!loadedMap) return null;

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <div
        ref={viewportRef}
        role="presentation"
        className={`combat-map-stage relative min-h-0 flex-1 touch-none select-none overflow-hidden${
          layout === "play" ? " combat-map-play-mode" : ""
        }`}
        style={{ cursor: viewportCursor }}
        onPointerDownCapture={onViewportPointerDownCapture}
        onPointerDown={onViewportPointerDown}
        onPointerMove={onViewportPointerMove}
        onPointerUp={onViewportPointerUp}
        onPointerCancel={onViewportPointerUp}
        onWheel={onViewportWheel}
        onPointerLeave={() => {
          hideRotateCursor();
          setHoverOobElementId(null);
        }}
      >
        <div
          ref={rotateCursorRef}
          className="pointer-events-none absolute z-[30] hidden text-orange-500"
          style={{ transform: "translate(-50%, -50%)" }}
          aria-hidden
        >
          <RotateCw className="size-5" strokeWidth={2.25} />
        </div>
        {showGrid && viewBox && layout === "edit" ? (
          <CombatMapViewportRulers
            viewportSize={viewportSize}
            viewBox={viewBox}
            pan={pan}
            scale={scale}
            marks={rulerMarks}
            chrome={mapChrome}
          />
        ) : null}
        {viewBox ? (
          <div
            ref={canvasRef}
            className="absolute left-0 top-0 origin-top-left"
            style={{
              width: viewBox.w,
              height: viewBox.h,
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
            }}
          >
            <div className="relative size-full">
              <div
                ref={mapSvgHostRef}
                className={`size-full [&_svg]:block [&_svg]:h-full [&_svg]:w-full [&_svg]:max-w-none${drawToolActive ? " combat-map-draw-mode" : ""}`}
                dangerouslySetInnerHTML={{ __html: displaySvg }}
              />
              {layout === "edit" ? (
                <svg
                  ref={editOverlayRef}
                  className="pointer-events-none absolute inset-0 z-[1] size-full overflow-visible"
                  viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
                  overflow="visible"
                  aria-hidden
                >
                  {artboard ? (
                    <defs>
                      <clipPath id={COMBAT_MAP_EDITOR_ARTBOARD_CLIP_ID}>
                        <rect x={artboard.x} y={artboard.y} width={artboard.w} height={artboard.h} />
                      </clipPath>
                    </defs>
                  ) : null}
                  <g clipPath={artboard ? `url(#${COMBAT_MAP_EDITOR_ARTBOARD_CLIP_ID})` : undefined}>
                    <CombatMapWallStrokeOverlay elements={elements} scale={scale} />
                  </g>
                  <CombatMapConcealmentLabelOverlay
                    elements={elements}
                    scale={scale}
                    metersPerUnit={metersPerUnit}
                  />
                  <CombatMapRoomLabelOverlay
                    elements={elements}
                    scale={scale}
                    metersPerUnit={metersPerUnit}
                  />
                  {showGrid && artboard ? (
                    <CombatMapGridOverlay
                      viewportSize={viewportSize}
                      viewBox={viewBox}
                      pan={pan}
                      scale={scale}
                      artboard={artboard}
                      metersPerUnit={metersPerUnit}
                      chrome={mapChrome}
                    />
                  ) : null}
                  {artboard ? (
                    <CombatMapOobOverlay
                      elements={elements}
                      artboard={artboard}
                      scale={scale}
                      hoverElementId={hoverOobElementId}
                      label={t("combat.editor.oobLabel")}
                    />
                  ) : null}
                </svg>
              ) : null}
              {layout === "play" && viewBox && playOverlayLayers ? (
                <CombatMapPlayOverlays
                  viewBox={viewBox}
                  metersPerUnit={metersPerUnit}
                  team={selectedNpcPlacement?.team}
                  fovPolygon={playOverlayLayers.fovPolygon}
                  movementDisk={playOverlayLayers.movementDisk}
                  coverMarks={playOverlayLayers.coverMarks}
                  showFov={playOverlayToggles.fov}
                  showPath={playOverlayToggles.path}
                  showCover={playOverlayToggles.cover}
                />
              ) : null}
            </div>
          </div>
        ) : null}
        {layout === "edit" && viewBox ? (
          <CombatMapScreenOverlay
            overlayRef={screenOverlayRef}
            viewportSize={viewportSize}
            viewBox={viewBox}
            pan={pan}
            scale={scale}
            artboard={showMapBoundsStroke ? artboard : null}
            boundsStroke={showMapBoundsStroke ? mapBoundsStroke : null}
            selectionOutlines={tool === "select" ? selectedOutlineBounds : []}
            drawPreview={drawToolActive ? drawPreview : null}
            marqueePreview={tool === "select" ? marqueePreview : null}
            scaleHandles={tool === "select" ? scaleHandles : null}
            pathVertices={
              tool === "select" && selected?.tag === "path" && selectedIds.length === 1 ? pathVertices : []
            }
            snapGuides={snapGuides}
            selectedId={
              tool === "select" && (transformIds.length > 1 || selectedIds.length === 1)
                ? (primaryId ?? "group")
                : null
            }
          />
        ) : null}
        {viewBox ? (
          <div
            className="pointer-events-none absolute z-20 select-none rounded-lg border border-foreground/10 bg-background/90 px-2 py-1 font-mono text-[10px] text-foreground/60 shadow-sm"
            style={
              showGrid && layout === "edit"
                ? { left: 4, bottom: 8, width: COMBAT_MAP_VIEWPORT_RULER_LEFT_W - 4, textAlign: "center" }
                : { left: 8, bottom: 8 }
            }
            aria-label={t("combat.editor.zoom", { percent: formatCombatMapZoomPercent(scale) })}
          >
            {formatCombatMapZoomPercent(scale)}
          </div>
        ) : null}
      </div>

      {showPlayPanel ? (
        <div
          className="pointer-events-auto absolute inset-0 z-[5] flex items-center justify-center bg-background/55 backdrop-blur-[1px]"
          aria-hidden
        >
          <Card radius="lg" padding="md" className="pointer-events-none border-2 border-border1 shadow3">
            <p className="text-lg font-black uppercase tracking-[0.2em] text-foreground/80">WIP</p>
          </Card>
        </div>
      ) : null}

      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col p-3 sm:p-4">
        <div className="shrink-0">
          <Card
            radius="full"
            padding="sm"
            className="pointer-events-auto h-11 w-fit max-w-full !flex-row flex-nowrap items-center gap-2 !py-2 !pl-4 !pr-2 shadow2"
          >
            <h1 className="min-w-0 max-w-[10rem] truncate text-sm font-black sm:max-w-[14rem] sm:text-base">
              {map.title}
            </h1>
            <div className="ml-1 flex shrink-0 items-center gap-1 rounded-full bg-content2 p-0.5 sm:ml-2">
              <Button
                variant={layout === "edit" ? "primary" : "ghost"}
                className="h-8 gap-1.5 rounded-full px-2.5 text-xs font-semibold sm:px-3 sm:text-sm"
                onPress={() => onLayoutChange("edit")}
                aria-label={t("combat.editor.mode.edit")}
              >
                <Pencil className="size-3.5 sm:size-4" />
                <span className="hidden sm:inline">{t("combat.editor.mode.edit")}</span>
              </Button>
              <Button
                variant={layout === "play" ? "primary" : "ghost"}
                className="h-8 gap-1.5 rounded-full px-2.5 text-xs font-semibold sm:px-3 sm:text-sm"
                onPress={() => onLayoutChange("play")}
                aria-label={t("combat.editor.mode.play")}
              >
                <Play className="size-3.5 sm:size-4" />
                <span className="hidden sm:inline">{t("combat.editor.mode.play")}</span>
              </Button>
            </div>
            {layout === "edit" ? (
              <>
                <Button
                  variant={showGrid ? "primary" : "ghost"}
                  className="h-8 shrink-0 gap-1.5 rounded-full px-2.5 text-xs font-semibold sm:px-3 sm:text-sm"
                  onPress={() => setShowGrid((on) => !on)}
                  aria-label={t("combat.editor.grid")}
                  aria-pressed={showGrid}
                >
                  <Grid3x3 className="size-3.5 sm:size-4" />
                  <span className="hidden sm:inline">{t("combat.editor.grid")}</span>
                </Button>
                <CombatMapImportInput onPick={(file) => void handleImportFile(file)}>
                  {(open) => (
                    <Button
                      variant="ghost"
                      className="h-8 shrink-0 gap-1.5 rounded-full px-2.5 text-xs font-semibold sm:px-3 sm:text-sm"
                      onPress={open}
                    >
                      <Upload className="size-3.5 sm:size-4" />
                      <span className="hidden sm:inline">{t("combat.editor.import")}</span>
                    </Button>
                  )}
                </CombatMapImportInput>
                <Button
                  variant="ghost"
                  className="h-8 shrink-0 gap-1.5 rounded-full px-2.5 text-xs font-semibold sm:px-3 sm:text-sm"
                  onPress={handleExportMap}
                >
                  <Download className="size-3.5 sm:size-4" />
                  <span className="hidden sm:inline">{t("combat.editor.export")}</span>
                </Button>
                <Button
                  variant={complianceReport.ok ? "ghost" : "secondary"}
                  className="h-8 shrink-0 gap-1.5 rounded-full px-2.5 text-xs font-semibold sm:px-3 sm:text-sm"
                  onPress={() => setComplianceOpen(true)}
                  aria-label={t("combat.editor.compliance.title")}
                >
                  {complianceReport.ok ? (
                    <CheckCircle2 className="size-3.5 sm:size-4 text-success" />
                  ) : (
                    <AlertTriangle className="size-3.5 sm:size-4 text-warning" />
                  )}
                  <span className="hidden sm:inline">{t("combat.editor.compliance.title")}</span>
                </Button>
                <Button
                  variant="primary"
                  className="h-8 shrink-0 gap-1.5 rounded-full px-3 text-xs font-semibold sm:text-sm"
                  isDisabled={saving}
                  onPress={() => void handleSave()}
                >
                  <Save className="size-3.5 sm:size-4" />
                  <span className="hidden sm:inline">{t("combat.editor.save")}</span>
                </Button>
              </>
            ) : null}
            {layout === "edit" ? (
              <Button
                variant="ghost"
                className="h-8 w-8 shrink-0 rounded-full p-0 text-base font-bold leading-none"
                aria-label={t("combat.editor.help.open")}
                onPress={() => setHelpOpen(true)}
              >
                ?
              </Button>
            ) : null}
          </Card>
        </div>

        {layout === "edit" || showPlayPanel ? (
          <div className="flex min-h-0 flex-1 justify-end pt-3">
            <Card
              as="aside"
              tone="shell"
              radius="lg"
              padding="none"
              className="pointer-events-auto hidden h-full w-72 min-h-0 overflow-y-auto shadow2 scrollbar-subtle md:block"
            >
              <PropertyPanel
                map={map}
                selected={selected}
                selectedElements={selectedElements}
                selectionCount={selectedIds.length}
                readOnly={showPlayPanel}
                playOverlayToggles={showPlayPanel ? playOverlayToggles : undefined}
                onPlayOverlayTogglesChange={showPlayPanel ? setPlayOverlayToggles : undefined}
                onPatch={patchElement}
                onPatchMany={patchMany}
                onPreviewPatch={previewElementPatch}
                onPreviewMany={previewMany}
                onDelete={deleteElement}
                onDeleteMany={deleteSelectedElements}
              />
            </Card>
          </div>
        ) : (
          <div className="min-h-0 flex-1" />
        )}

        {layout === "edit" ? (
          <p className="pointer-events-none shrink-0 select-none px-1 pt-2 text-[10px] text-foreground/45">
            {t("combat.editor.canvasHint")}
          </p>
        ) : null}

        {layout === "edit" ? (
          <div className="pointer-events-auto flex shrink-0 justify-center pt-2">
            <Card
              radius="full"
              padding="sm"
              className="!flex-row max-w-full flex-nowrap items-center justify-center gap-1 overflow-x-auto shadow2 scrollbar-subtle"
            >
              {tools.map((entry) => {
                const Icon = entry.icon;
                const active = tool === entry.id;
                return (
                  <Button
                    key={entry.id}
                    variant={active ? "primary" : "ghost"}
                    className="h-10 gap-2 rounded-full px-3 font-semibold"
                    onPress={() => {
                      setTool(entry.id);
                      if (isCombatDrawTool(entry.id)) onSelectIds([]);
                      if (entry.id === "npc") setNpcModalOpen(true);
                    }}
                  >
                    <Icon className="size-4" />
                    <span className="hidden sm:inline">{entry.label}</span>
                  </Button>
                );
              })}
            </Card>
          </div>
        ) : null}

        {layout === "edit" || showPlayPanel ? (
          <Card
            as="aside"
            tone="shell"
            radius="lg"
            padding="none"
            className="pointer-events-auto mt-3 max-h-[38vh] overflow-y-auto shadow2 scrollbar-subtle md:hidden"
          >
            <PropertyPanel
              map={map}
              selected={selected}
              selectedElements={selectedElements}
              selectionCount={selectedIds.length}
              readOnly={showPlayPanel}
              playOverlayToggles={showPlayPanel ? playOverlayToggles : undefined}
              onPlayOverlayTogglesChange={showPlayPanel ? setPlayOverlayToggles : undefined}
              onPatch={patchElement}
              onPatchMany={patchMany}
              onPreviewPatch={previewElementPatch}
              onPreviewMany={previewMany}
              onDelete={deleteElement}
              onDeleteMany={deleteSelectedElements}
            />
          </Card>
        ) : null}
      </div>

      {contextMenu ? (
        <Card
          role="menu"
          radius="md"
          padding="sm"
          data-combat-context-menu=""
          className="fixed z-50 min-w-36 !gap-0 !p-1 shadow3"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            type="button"
            role="menuitem"
            className="w-full rounded-md px-3 py-2 text-left text-sm font-semibold text-error hover:bg-content2"
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              deleteElement(contextMenu.id);
            }}
          >
            {t("combat.editor.delete")}
          </button>
        </Card>
      ) : null}

      <Modal isOpen={complianceOpen} onOpenChange={setComplianceOpen}>
        <Modal.Backdrop>
          <Modal.Container size="md">
            <Modal.Dialog>
              <Modal.Header>{t("combat.editor.compliance.title")}</Modal.Header>
              <Modal.Body className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto">
                {complianceReport.ok ? (
                  <p className="text-sm text-success">{t("combat.editor.compliance.ok")}</p>
                ) : (
                  <p className="text-sm text-foreground/70">
                    {t("combat.editor.compliance.summary", {
                      errors: complianceReport.errorCount,
                      warnings: complianceReport.warningCount,
                    })}
                  </p>
                )}
                {complianceReport.issues.length > 0 ? (
                  <ul className="flex flex-col gap-2">
                    {complianceReport.issues.map((issue) => (
                      <li
                        key={issue.id}
                        className={`rounded-xl border px-3 py-2 text-sm ${
                          issue.severity === "error" ? "border-error/30 bg-error/5" : "border-warning/30 bg-warning/5"
                        }`}
                      >
                        {formatCombatMapComplianceIssue(issue, t)}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </Modal.Body>
              <Modal.Footer>
                <Button variant="primary" onPress={() => setComplianceOpen(false)}>
                  {t("common.close")}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      <Modal isOpen={importFailure !== null} onOpenChange={(open) => !open && setImportFailure(null)}>
        <Modal.Backdrop>
          <Modal.Container size="md">
            <Modal.Dialog>
              <Modal.Header>{t("combat.editor.import")}</Modal.Header>
              <Modal.Body className="flex flex-col gap-3">
                <p className="text-sm text-error">
                  {importFailure && !importFailure.ok ? t(importFailure.errorKey) : t("combat.editor.import.failed")}
                </p>
                {importFailure && !importFailure.ok && importFailure.issues?.length ? (
                  <ul className="flex max-h-[40vh] flex-col gap-2 overflow-y-auto">
                    {importFailure.issues.map((issue) => (
                      <li key={issue.id} className="rounded-xl border border-error/30 bg-error/5 px-3 py-2 text-sm">
                        {formatCombatMapComplianceIssue(issue, t)}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </Modal.Body>
              <Modal.Footer>
                <Button variant="primary" onPress={() => setImportFailure(null)}>
                  {t("common.close")}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      <Modal isOpen={helpOpen} onOpenChange={setHelpOpen}>
        <Modal.Backdrop>
          <Modal.Container size="md">
            <Modal.Dialog>
              <Modal.Header>{t("combat.editor.help.title")}</Modal.Header>
              <Modal.Body className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto">
                <ul className="flex flex-col gap-2">
                  {COMBAT_MAP_EDITOR_HELP_ENTRIES.map((entry) => (
                    <li
                      key={entry.id}
                      className="flex items-start justify-between gap-3 rounded-xl border border-border1 px-3 py-2 text-sm"
                    >
                      <span className="font-medium text-foreground/80">{t(entry.labelKey)}</span>
                      {entry.shortcut ? (
                        <Kbd>{entry.shortcut}</Kbd>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="primary" onPress={() => setHelpOpen(false)}>
                  {t("common.close")}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      <Modal isOpen={npcModalOpen} onOpenChange={setNpcModalOpen}>
        <Modal.Backdrop>
          <Modal.Container size="md">
            <Modal.Dialog>
              <Modal.Header>{t("combat.editor.npcModal.title")}</Modal.Header>
              <Modal.Body className="flex max-h-[50vh] flex-col gap-2 overflow-y-auto">
                {weaponSheets.length === 0 ? (
                  <p className="text-sm text-foreground/60">{t("combat.editor.npcModal.empty")}</p>
                ) : (
                  weaponSheets.map((sheet) => (
                    <button
                      key={sheet.id}
                      type="button"
                      className={`rounded-xl border px-3 py-2 text-left text-sm font-semibold transition-colors ${
                        pendingNpcSheetId === sheet.id
                          ? "border-primary bg-primary/10"
                          : "border-border1 hover:bg-content2"
                      }`}
                      onClick={() => setPendingNpcSheetId(sheet.id)}
                    >
                      {sheetListLabel(sheet)}
                    </button>
                  ))
                )}
              </Modal.Body>
              <Modal.Footer>
                <Button variant="ghost" onPress={() => setNpcModalOpen(false)}>
                  {t("combat.editor.cancel")}
                </Button>
                <Button
                  variant="primary"
                  isDisabled={!pendingNpcSheetId}
                  onPress={() => pendingNpcSheetId && placeNpcAtCenter(pendingNpcSheetId)}
                >
                  {t("combat.editor.npcModal.insert")}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  );
}

export function combatEditorLayerLabel(
  el: CombatMapElement,
  t: (key: string) => string,
): string {
  return elementLabel(el, t);
}
