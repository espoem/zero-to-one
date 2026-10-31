import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

export type PipelineStage = 'layout' | 'paint' | 'composite';

export interface PropertyPerformanceProfile {
  property: string;
  invalidationStage: PipelineStage;
  triggersForcedLayout: boolean;
  canRunOnCompositorThread: boolean;
}

export const PROPERTY_PROFILES: Record<string, PropertyPerformanceProfile> = {
  // Layout triggers
  width: { property: 'width', invalidationStage: 'layout', triggersForcedLayout: true, canRunOnCompositorThread: false },
  height: { property: 'height', invalidationStage: 'layout', triggersForcedLayout: true, canRunOnCompositorThread: false },
  margin: { property: 'margin', invalidationStage: 'layout', triggersForcedLayout: true, canRunOnCompositorThread: false },
  padding: { property: 'padding', invalidationStage: 'layout', triggersForcedLayout: true, canRunOnCompositorThread: false },
  top: { property: 'top', invalidationStage: 'layout', triggersForcedLayout: true, canRunOnCompositorThread: false },
  left: { property: 'left', invalidationStage: 'layout', triggersForcedLayout: true, canRunOnCompositorThread: false },

  // Paint triggers
  color: { property: 'color', invalidationStage: 'paint', triggersForcedLayout: false, canRunOnCompositorThread: false },
  'background-color': { property: 'background-color', invalidationStage: 'paint', triggersForcedLayout: false, canRunOnCompositorThread: false },
  'box-shadow': { property: 'box-shadow', invalidationStage: 'paint', triggersForcedLayout: false, canRunOnCompositorThread: false },
  visibility: { property: 'visibility', invalidationStage: 'paint', triggersForcedLayout: false, canRunOnCompositorThread: false },
  filter: { property: 'filter', invalidationStage: 'paint', triggersForcedLayout: false, canRunOnCompositorThread: false },
  'backdrop-filter': { property: 'backdrop-filter', invalidationStage: 'paint', triggersForcedLayout: false, canRunOnCompositorThread: false },

  // Composite-only triggers
  transform: { property: 'transform', invalidationStage: 'composite', triggersForcedLayout: false, canRunOnCompositorThread: true },
  opacity: { property: 'opacity', invalidationStage: 'composite', triggersForcedLayout: false, canRunOnCompositorThread: true },
};

export class PipelineAnalyzer {
  static getInvalidationStage(property: string): PipelineStage {
    const profile = PROPERTY_PROFILES[property];
    if (!profile) {
      throw new Error(`Unknown CSS property profile: ${property}`);
    }
    return profile.invalidationStage;
  }

  static isCompositeOnly(property: string): boolean {
    return PROPERTY_PROFILES[property]?.invalidationStage === 'composite';
  }

  static detectLayoutThrashing(operations: Array<'read' | 'write'>): number {
    let thrashingEvents = 0;
    let pendingWrite = false;

    for (const op of operations) {
      if (op === 'write') {
        pendingWrite = true;
      } else if (op === 'read' && pendingWrite) {
        thrashingEvents++;
        pendingWrite = false; // Layout forced and cache refreshed
      }
    }

    return thrashingEvents;
  }
}

describe('Module 13: Rendering Pipeline & Performance', () => {
  it('correctly classifies composite-only animation properties', () => {
    assert.equal(PipelineAnalyzer.isCompositeOnly('transform'), true);
    assert.equal(PipelineAnalyzer.isCompositeOnly('opacity'), true);
    assert.equal(PipelineAnalyzer.isCompositeOnly('filter'), false, 'filter triggers paint invalidation');
    assert.equal(PipelineAnalyzer.isCompositeOnly('backdrop-filter'), false, 'backdrop-filter triggers paint invalidation');
    assert.equal(PipelineAnalyzer.isCompositeOnly('top'), false, 'top triggers reflow / layout');
  });

  it('verifies paint-stage invalidation for color and filter changes', () => {
    assert.equal(PipelineAnalyzer.getInvalidationStage('color'), 'paint');
    assert.equal(PipelineAnalyzer.getInvalidationStage('background-color'), 'paint');
    assert.equal(PipelineAnalyzer.getInvalidationStage('box-shadow'), 'paint');
    assert.equal(PipelineAnalyzer.getInvalidationStage('filter'), 'paint');
  });

  it('detects forced synchronous layout and layout thrashing in read/write interleaving', () => {
    // Interleaved read/write loop triggers forced layout on each read following a write
    const thrashingSequence: Array<'read' | 'write'> = [
      'write', 'read',
      'write', 'read',
      'write', 'read',
    ];
    assert.equal(PipelineAnalyzer.detectLayoutThrashing(thrashingSequence), 3);

    // Batched reads first, then writes: zero thrashing events
    const batchedSequence: Array<'read' | 'write'> = [
      'read', 'read', 'read',
      'write', 'write', 'write',
    ];
    assert.equal(PipelineAnalyzer.detectLayoutThrashing(batchedSequence), 0);
  });
});
