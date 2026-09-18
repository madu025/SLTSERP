/**
 * Rule Engine for Process Gate Policy Condition Evaluation
 * Evaluates a JSON condition block against a data object.
 * 
 * Example Condition JSON:
 * {
 *    "field": "totalValue",
 *    "operator": ">=",
 *    "value": 500000
 * }
 */

export type Operator = '==' | '!=' | '>' | '<' | '>=' | '<=' | 'IN' | 'NOT_IN';

export interface RuleCondition {
    field: string;
    operator: Operator;
    value: unknown;
}

export class RuleEngine {
    /**
     * Evaluates a single rule condition against the given entity payload.
     * @param condition The condition to evaluate
     * @param payload The data object to evaluate against
     * @returns Boolean indicating whether the condition is met
     */
    static evaluate(condition: RuleCondition | RuleCondition[] | null | undefined, payload: Record<string, unknown>): boolean {
        if (!condition) return true; // No condition means always pass

        // If the condition is an array of conditions (AND logic)
        if (Array.isArray(condition)) {
            return condition.every(cond => this.evaluateSingle(cond, payload));
        }

        // Single condition
        return this.evaluateSingle(condition, payload);
    }

    private static evaluateSingle(condition: RuleCondition, payload: Record<string, unknown>): boolean {
        if (!condition || !condition.field || !condition.operator) {
            console.warn('Invalid condition format:', condition);
            return true; // Failsafe
        }

        const actualValue = this.resolveField(payload, condition.field);
        const expectedValue = condition.value;

        switch (condition.operator) {
            case '==': return actualValue === expectedValue;
            case '!=': return actualValue !== expectedValue;
            case '>': return typeof actualValue === 'number' && typeof expectedValue === 'number' && actualValue > expectedValue;
            case '<': return typeof actualValue === 'number' && typeof expectedValue === 'number' && actualValue < expectedValue;
            case '>=': return typeof actualValue === 'number' && typeof expectedValue === 'number' && actualValue >= expectedValue;
            case '<=': return typeof actualValue === 'number' && typeof expectedValue === 'number' && actualValue <= expectedValue;
            case 'IN': return Array.isArray(expectedValue) && expectedValue.includes(actualValue);
            case 'NOT_IN': return Array.isArray(expectedValue) && !expectedValue.includes(actualValue);
            default:
                console.warn(`Unsupported operator: ${condition.operator}`);
                return false;
        }
    }

    /**
     * Resolves dot-notation field paths (e.g. 'user.department.id')
     */
    private static resolveField(obj: Record<string, unknown> | null | undefined, path: string): unknown {
        if (!obj) return undefined;
        return path.split('.').reduce<unknown>((prev, curr) => {
            if (prev && typeof prev === 'object' && curr in prev) {
                return (prev as Record<string, unknown>)[curr];
            }
            return undefined;
        }, obj);
    }
}
