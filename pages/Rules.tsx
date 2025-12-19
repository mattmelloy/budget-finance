import React, { useState, useEffect } from 'react';
import { useData } from '../hooks/useData';
import { Rule, RuleConditionType } from '../types';
import { Button } from '../components/ui/button';
import Modal from '../components/Modal';
import Icon from '../components/Icon';

const RuleForm: React.FC<{
    onSave: (rule: Rule | Omit<Rule, 'id'>) => Promise<void>;
    onClose: () => void;
    initialData?: Rule | Omit<Rule, 'id'> | null;
}> = ({ onSave, onClose, initialData }) => {
    const { categories } = useData();
    const [conditionType, setConditionType] = useState<RuleConditionType>('contains');
    const [conditionValue, setConditionValue] = useState('');
    const [categoryId, setCategoryId] = useState(categories[0]?.id || '');

    useEffect(() => {
        if (initialData) {
            setConditionType(initialData.conditionType);
            setConditionValue(initialData.conditionValue);
            setCategoryId(initialData.categoryId);
        } else {
            setConditionType('contains');
            setConditionValue('');
            setCategoryId(categories[0]?.id || '');
        }
    }, [initialData, categories]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (conditionValue && categoryId) {
            const ruleData = { conditionType, conditionValue, categoryId };
            if (initialData && 'id' in initialData && initialData.id) {
                await onSave({ ...ruleData, id: initialData.id });
            } else {
                await onSave(ruleData);
            }
            onClose();
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-700">Condition</label>
                <div className="mt-1 flex rounded-md shadow-sm">
                    <select
                        value={conditionType}
                        onChange={e => setConditionType(e.target.value as RuleConditionType)}
                        className="px-3 py-2 block border border-gray-300 rounded-l-md focus:ring-blue-500 focus:border-blue-500"
                    >
                        <option value="contains">Contains</option>
                        <option value="startsWith">Starts with</option>
                        <option value="equals">Equals</option>
                    </select>
                    <input
                        type="text"
                        value={conditionValue}
                        onChange={e => setConditionValue(e.target.value)}
                        placeholder="e.g., 'Woolworths'"
                        required
                        className="flex-1 min-w-0 block w-full px-3 py-2 rounded-none rounded-r-md focus:ring-blue-500 focus:border-blue-500 border border-gray-300"
                    />
                </div>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700">Assign to Category</label>
                <select
                    value={categoryId}
                    onChange={e => setCategoryId(e.target.value)}
                    required
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                >
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
            </div>
            <div className="flex justify-end space-x-2 pt-2">
                <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
                <Button type="submit" variant="default">Save Rule</Button>
            </div>
        </form>
    );
};

const Rules: React.FC = () => {
    const { rules, categories, addRule, updateRule, deleteRule, reorderRules, ruleToEdit, setRuleToEdit, applyRuleToTransactions } = useData();
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [editingRule, setEditingRule] = useState<Rule | null>(null);
    const [ruleToConfirmApply, setRuleToConfirmApply] = useState<Rule | null>(null);
    const [notificationMessage, setNotificationMessage] = useState<string | null>(null);

    const [localRules, setLocalRules] = useState<Rule[]>(rules);
    useEffect(() => setLocalRules(rules), [rules]);

    const [draggingId, setDraggingId] = useState<string | null>(null);

    useEffect(() => {
        if (ruleToEdit) {
            setEditingRule(null);
            setIsFormModalOpen(true);
        }
    }, [ruleToEdit]);

    const onDragStart = (e: React.DragEvent, id: string) => {
        setDraggingId(id);
        try { e.dataTransfer?.setData('text/plain', id); } catch {}
        if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
    };

    const onDragOverRow = (e: React.DragEvent) => {
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    };

    const onDropOnRow = async (e: React.DragEvent, targetId: string) => {
        e.preventDefault();
        const draggedId = (e.dataTransfer?.getData('text/plain')) || draggingId;
        if (!draggedId || draggedId === targetId) {
            setDraggingId(null);
            return;
        }

        const ids = localRules.map(r => r.id);
        const from = ids.indexOf(draggedId);
        const to = ids.indexOf(targetId);
        if (from === -1 || to === -1) {
            setDraggingId(null);
            return;
        }

        ids.splice(from, 1);
        ids.splice(to, 0, draggedId);

        const newOrder = ids.map(id => localRules.find(r => r.id === id)!).filter(Boolean);
        setLocalRules(newOrder);

        try {
            await reorderRules(ids);
        } catch (err) {
            setLocalRules(rules);
        } finally {
            setDraggingId(null);
        }
    };

    const handleOpenAddModal = () => {
        setRuleToEdit(null);
        setEditingRule(null);
        setIsFormModalOpen(true);
    };

    const handleOpenEditModal = (rule: Rule) => {
        setRuleToEdit(null);
        setEditingRule(rule);
        setIsFormModalOpen(true);
    };

    const handleCloseFormModal = () => {
        setIsFormModalOpen(false);
        setRuleToEdit(null);
        setEditingRule(null);
    };

    const handleSaveRule = async (ruleData: Rule | Omit<Rule, 'id'>) => {
        let savedRule;
        if ('id' in ruleData && ruleData.id) {
            savedRule = await updateRule(ruleData as Rule);
        } else {
            savedRule = await addRule(ruleData);
        }

        if (savedRule) {
            setRuleToConfirmApply(savedRule);
        }
    };

    const handleConfirmApply = async () => {
        if (!ruleToConfirmApply) return;
        const count = await applyRuleToTransactions(ruleToConfirmApply);
        setRuleToConfirmApply(null);
        setNotificationMessage(`${count} transaction(s) were successfully updated.`);
    };

    const getCategoryName = (categoryId: string) => {
        return categories.find(c => c.id === categoryId)?.name || 'N/A';
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-900">Categorization Rules</h1>
                <Button variant="default" onClick={handleOpenAddModal}>
                    <Icon name="plus" className="h-5 w-5 mr-2" />
                    Add New Rule
                </Button>
            </div>

            <div className="bg-white shadow rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Condition</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Value</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {localRules.map((rule, index) => (
                                <tr
                                    key={rule.id}
                                    draggable
                                    onDragStart={(e) => onDragStart(e, rule.id)}
                                    onDragOver={onDragOverRow}
                                    onDrop={(e) => onDropOnRow(e, rule.id)}
                                    onDragEnd={() => setDraggingId(null)}
                                    className={draggingId === rule.id ? 'bg-gray-50' : undefined}
                                >
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{index + 1}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">{rule.conditionType}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{rule.conditionValue}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{getCategoryName(rule.categoryId)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium flex justify-end items-center space-x-4">
                                        <div
                                            className="cursor-grab p-2 text-gray-600 hover:text-gray-900"
                                            title="Drag to reorder"
                                            aria-label="Drag to reorder"
                                        >
                                            <Icon name="drag" className="h-5 w-5" />
                                        </div>
                                        <button onClick={() => setRuleToConfirmApply(rule)} className="text-green-600 hover:text-green-900" title={`Apply rule for ${rule.conditionValue}`} aria-label={`Apply rule for ${rule.conditionValue}`}>
                                            <Icon name="play" className="h-5 w-5" />
                                        </button>
                                        <button onClick={() => handleOpenEditModal(rule)} className="text-blue-600 hover:text-blue-900" title={`Edit rule for ${rule.conditionValue}`} aria-label={`Edit rule for ${rule.conditionValue}`}>
                                            <Icon name="edit" className="h-5 w-5" />
                                        </button>
                                        <button onClick={() => deleteRule(rule.id)} className="text-red-600 hover:text-red-900" title={`Delete rule for ${rule.conditionValue}`} aria-label={`Delete rule for ${rule.conditionValue}`}>
                                            <Icon name="trash" className="h-5 w-5" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {localRules.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                        <p>No rules defined yet.</p>
                        <p>Add rules to automate transaction categorization during import.</p>
                    </div>
                )}
            </div>

            <Modal isOpen={isFormModalOpen} onClose={handleCloseFormModal} title={editingRule ? "Edit Rule" : "Add New Rule"}>
                <RuleForm onSave={handleSaveRule} onClose={handleCloseFormModal} initialData={editingRule || ruleToEdit} />
            </Modal>

            <Modal isOpen={!!ruleToConfirmApply} onClose={() => setRuleToConfirmApply(null)} title="Apply Rule">
                <p className="mb-4">
                    Apply this rule to all existing transactions?
                </p>
                <div className="flex justify-end space-x-2">
                    <Button variant="secondary" onClick={() => setRuleToConfirmApply(null)}>Cancel</Button>
                    <Button variant="default" onClick={handleConfirmApply}>Apply</Button>
                </div>
            </Modal>

            <Modal isOpen={!!notificationMessage} onClose={() => setNotificationMessage(null)} title="Action Complete">
                <p className="mb-4">{notificationMessage}</p>
                <div className="flex justify-end">
                    <Button variant="default" onClick={() => setNotificationMessage(null)}>OK</Button>
                </div>
            </Modal>
        </div>
    );
};

export default Rules;
