import { selectAgent, type AgentAssignmentCandidate } from './agent-assignment.js';

const date = (day: number) => new Date(`2026-09-${String(day).padStart(2, '0')}T00:00:00.000Z`);

const candidate = (
  id: string,
  workload: number,
  lastAssignedAt: Date | null,
  createdAt = date(1),
): AgentAssignmentCandidate => ({ id, workload, lastAssignedAt, createdAt });

describe('selectAgent', () => {
  it('chooses the agent with the lowest active workload', () => {
    const selected = selectAgent([
      candidate('busy', 3, date(2)),
      candidate('free', 1, date(8)),
    ]);

    expect(selected?.id).toBe('free');
  });

  it('breaks workload ties by oldest assignment, then agent creation time and id', () => {
    const selected = selectAgent([
      candidate('recent', 2, date(10), date(1)),
      candidate('newer', 2, date(5), date(3)),
      candidate('oldest', 2, date(5), date(2)),
      candidate('never-assigned', 2, null, date(4)),
    ]);

    expect(selected?.id).toBe('never-assigned');
    expect(
      selectAgent([
        candidate('recent', 2, date(10)),
        candidate('later-created', 2, date(5), date(3)),
        candidate('earlier-created', 2, date(5), date(2)),
      ])?.id,
    ).toBe('earlier-created');
    expect(
      selectAgent([
        candidate('z-agent', 2, date(5), date(2)),
        candidate('a-agent', 2, date(5), date(2)),
      ])?.id,
    ).toBe('a-agent');
  });

  it('returns undefined when no active agents are available', () => {
    expect(selectAgent([])).toBeUndefined();
  });
});