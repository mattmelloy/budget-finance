import React, { useState, useMemo } from 'react';
import { useData } from '../hooks/useData';
import { Category, Budget } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

const Budgets: React.FC = () => {
  const { budgets, categories, addBudget, updateBudget, deleteBudget } = useData();
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);

  const categoryMap = useMemo(() => {
    return new Map(categories.map(c => [c.id, c]));
  }, [categories]);

  const handleEdit = (budget: Budget) => {
    setEditingBudget(budget);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this budget?')) {
      deleteBudget(id);
    }
  };

  const handleSave = (budget: Budget) => {
    if (editingBudget) {
      updateBudget(budget);
    }
    setEditingBudget(null);
  };
  
  const handleAddNew = () => {
    const newBudget: Budget = {
      id: '',
      categoryId: '',
      recommendedMinPercent: 0,
      recommendedMaxPercent: 0,
    };
    setEditingBudget(newBudget);
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Budgets</h1>
        <Button onClick={handleAddNew}>Add New Budget</Button>
      </div>

      {editingBudget && (
        <EditBudgetForm
          budget={editingBudget}
          categories={categories}
          onSave={handleSave}
          onCancel={() => setEditingBudget(null)}
          addBudget={addBudget}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Existing Budgets</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {budgets.map(budget => {
              const category = categoryMap.get(budget.categoryId);
              return (
                <div key={budget.id} className="flex items-center justify-between p-2 border rounded-md">
                  <div>
                    <p className="font-semibold">{category?.name || 'Uncategorized'}</p>
                    <p className="text-sm text-gray-600">{category?.description}</p>
                    <p className="text-sm text-gray-500 mt-1">
                      Recommended Range: {budget.recommendedMinPercent}% - {budget.recommendedMaxPercent}%
                    </p>
                  </div>
                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm" onClick={() => handleEdit(budget)}>Edit</Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(budget.id)}>Delete</Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

interface EditBudgetFormProps {
    budget: Budget;
    categories: Category[];
    onSave: (budget: Budget) => void;
    onCancel: () => void;
    addBudget: (budget: Omit<Budget, 'id'>) => void;
}

const EditBudgetForm: React.FC<EditBudgetFormProps> = ({ budget, categories, onSave, onCancel, addBudget }) => {
    const [editedBudget, setEditedBudget] = useState(budget);
  
    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (editedBudget.id) {
        onSave(editedBudget);
      } else {
        const { id, ...newBudget } = editedBudget;
        addBudget(newBudget);
        onCancel(); 
      }
    };
  
    return (
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>{editedBudget.id ? 'Edit Budget' : 'Add New Budget'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Select
              value={editedBudget.categoryId}
              onValueChange={(value) => setEditedBudget({ ...editedBudget, categoryId: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="number"
              placeholder="Recommended Min %"
              value={editedBudget.recommendedMinPercent || ''}
              onChange={(e) => setEditedBudget({ ...editedBudget, recommendedMinPercent: Number(e.target.value) })}
            />
            <Input
              type="number"
              placeholder="Recommended Max %"
              value={editedBudget.recommendedMaxPercent || ''}
              onChange={(e) => setEditedBudget({ ...editedBudget, recommendedMaxPercent: Number(e.target.value) })}
            />
            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
              <Button type="submit">Save</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    );
};

export default Budgets;
