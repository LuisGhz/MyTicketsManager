export interface AgentAssignmentCandidate {
  id: string;
  createdAt: Date;
  workload: number;
  lastAssignedAt: Date | null;
}

export function selectAgent<T extends AgentAssignmentCandidate>(
  agents: readonly T[],
): T | undefined {
  return [...agents].sort((left, right) => {
    if (left.workload !== right.workload) return left.workload - right.workload;
    if (left.lastAssignedAt === null && right.lastAssignedAt !== null) return -1;
    if (left.lastAssignedAt !== null && right.lastAssignedAt === null) return 1;
    if (left.lastAssignedAt && right.lastAssignedAt) {
      const recencyDifference = left.lastAssignedAt.getTime() - right.lastAssignedAt.getTime();
      if (recencyDifference !== 0) return recencyDifference;
    }
    const creationDifference = left.createdAt.getTime() - right.createdAt.getTime();
    if (creationDifference !== 0) return creationDifference;
    return left.id.localeCompare(right.id);
  })[0];
}