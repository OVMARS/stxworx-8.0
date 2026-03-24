type ProjectMilestoneShape = {
  numMilestones?: number | null;
  milestone1Amount?: string | number | null;
  milestone2Amount?: string | number | null;
  milestone3Amount?: string | number | null;
  milestone4Amount?: string | number | null;
};

const DECIMAL_SCALE = 100_000_000;

function toFiniteNumber(value: string | number | null | undefined) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function toDecimalString(units: number) {
  const value = (units / DECIMAL_SCALE).toFixed(8).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
  return value === '-0' ? '0' : value;
}

function resolveMilestoneCount(project: ProjectMilestoneShape) {
  const count = Number(project.numMilestones ?? 0);
  if (Number.isInteger(count) && count >= 1) {
    return Math.min(4, count);
  }

  const amounts = [
    project.milestone1Amount,
    project.milestone2Amount,
    project.milestone3Amount,
    project.milestone4Amount,
  ].map(toFiniteNumber);

  const nonZeroCount = amounts.filter((amount) => amount > 0).length;
  return Math.min(4, Math.max(1, nonZeroCount || 1));
}

export function getProjectMilestoneAmounts(project: ProjectMilestoneShape) {
  return [
    project.milestone1Amount ?? '0',
    project.milestone2Amount ?? '0',
    project.milestone3Amount ?? '0',
    project.milestone4Amount ?? '0',
  ];
}

export function distributeProjectAmount(
  project: ProjectMilestoneShape,
  proposedAmount: string | number | null | undefined,
) {
  const milestoneCount = resolveMilestoneCount(project);
  const sourceAmounts = getProjectMilestoneAmounts(project).map(toFiniteNumber).slice(0, milestoneCount);
  const sourceTotal = sourceAmounts.reduce((sum, amount) => sum + amount, 0);
  const normalizedAmount = toFiniteNumber(proposedAmount);
  const totalUnits = Math.round(normalizedAmount * DECIMAL_SCALE);

  if (totalUnits <= 0) {
    throw new Error('Proposed amount must be greater than 0');
  }

  const distributedUnits = Array.from({ length: milestoneCount }, () => 0);

  if (sourceTotal > 0) {
    let allocatedUnits = 0;

    for (let index = 0; index < milestoneCount; index += 1) {
      if (index === milestoneCount - 1) {
        distributedUnits[index] = totalUnits - allocatedUnits;
        continue;
      }

      const amount = Math.max(0, sourceAmounts[index] || 0);
      const units = Math.floor((amount / sourceTotal) * totalUnits);
      distributedUnits[index] = units;
      allocatedUnits += units;
    }
  } else {
    const baseUnits = Math.floor(totalUnits / milestoneCount);
    const remainderUnits = totalUnits - baseUnits * milestoneCount;

    for (let index = 0; index < milestoneCount; index += 1) {
      distributedUnits[index] = baseUnits + (index === milestoneCount - 1 ? remainderUnits : 0);
    }
  }

  const amounts = [0, 0, 0, 0].map((_, index) => toDecimalString(distributedUnits[index] || 0));

  return {
    amounts,
    milestone1Amount: amounts[0],
    milestone2Amount: amounts[1],
    milestone3Amount: amounts[2],
    milestone4Amount: amounts[3],
    totalAmount: toDecimalString(totalUnits),
  };
}
