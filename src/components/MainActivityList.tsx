import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { mainActivities } from '../lib/api';
import { BarChart3, AlertCircle, CheckCircle, Edit, Trash2, Lock, PlusCircle, Building2, Info, DollarSign, Eye } from 'lucide-react';
import { useLanguage } from '../lib/i18n/LanguageContext';
import type { MainActivity } from '../types/organization';
import { auth } from '../lib/api';
import { isPlanner } from '../types/user';

interface MainActivityListProps {
  initiativeId: string;
  initiativeWeight: number;
  onEditActivity: (activity: MainActivity) => void;
  onSelectActivity?: (activity: MainActivity) => void;
  onAddBudget?: (activity: MainActivity) => void;
  onViewBudget?: (activity: MainActivity) => void;
  onEditBudget?: (activity: MainActivity) => void;
  isNewPlan?: boolean;
  planKey?: string;
  isUserPlanner: boolean;
  userOrgId: number | null;
  onDeleteBudget?: (activityId: string) => void;
}

const MainActivityList: React.FC<MainActivityListProps> = ({ 
  initiativeId,
  initiativeWeight,
  onEditActivity,
  onSelectActivity,
  onAddBudget,
  onViewBudget,
  onEditBudget,
  isNewPlan = false,
  planKey = 'default',
  isUserPlanner,
  userOrgId,
  onDeleteBudget
}) => {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [validationSuccess, setValidationSuccess] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  
  // Fetch all main activities for this initiative
  const { data: activitiesList, isLoading } = useQuery({
    queryKey: ['main-activities', initiativeId, planKey],
    queryFn: async () => {
      if (!initiativeId) {
        console.log('Missing initiativeId, cannot fetch main activities');
        return { data: [] };
      }
      
      console.log(`Fetching main activities for initiative ${initiativeId}`);
      const response = await mainActivities.getByInitiative(initiativeId);
      console.log('Fetched main activities:', response.data);
      return response;
    },
    enabled: !!initiativeId,
    staleTime: 0,
    cacheTime: 0,
  });

  // Delete activity mutation
  const deleteActivityMutation = useMutation({
    mutationFn: (activityId: string) => mainActivities.delete(activityId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['main-activities', initiativeId, planKey] });
    }
  });

  // Handle activity deletion
  const handleDeleteActivity = (activityId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (window.confirm('Are you sure you want to delete this main activity? This action cannot be undone.')) {
      deleteActivityMutation.mutate(activityId);
    }
  };

  // Handle budget deletion

  // Handle activity validation
  const handleValidateActivities = () => {
    setValidationSuccess(null);
    setValidationError(null);
    
    console.log('Validating activities:', {
      initiativeWeight,
      totalWeight: total_activities_weight,
      isValid: is_valid
    });

    if (is_valid) {
      setValidationSuccess(`Main activities weights are valid (${total_activities_weight.toFixed(2)}% = ${expected_activities_weight.toFixed(2)}%)`);
      setTimeout(() => setValidationSuccess(null), 3000);
    } else {
      setValidationError(`Main activities weights (${total_activities_weight.toFixed(2)}%) must equal 65% of initiative weight (${expected_activities_weight.toFixed(2)}%)`);
      setTimeout(() => setValidationError(null), 5000);
    }
  };

  if (isLoading && initiativeId) {
    return <div className="text-center p-4">{t('common.loading')}</div>;
  }

  if (!activitiesList?.data) {
    return null;
  }

  console.log('Main activities data:', activitiesList.data);

  // Filter activities based on user organization
  const filteredActivities = (activitiesList.data || []).filter(activity => 
    !activity.organization || activity.organization === userOrgId
  );
  
  console.log('MainActivityList: Weight calculation debug:', {
    totalActivities: activitiesList.data?.length || 0,
    filteredActivities: filteredActivities.length,
    userOrgId,
    initiativeWeight
  });
  
  const total_activities_weight = filteredActivities.reduce((sum, activity) => 
    sum + (Number(activity.weight) || 0), 0
  );
  
  const expected_activities_weight = parseFloat((initiativeWeight * 0.65).toFixed(2));
  const remaining_weight = expected_activities_weight - total_activities_weight;
  
  console.log('MainActivityList: Final weight calculation:', {
    initiativeWeight,
    expected_activities_weight,
    total_activities_weight,
    remaining_weight,
    filteredActivitiesCount: filteredActivities.length
  });
  
  const is_valid = Math.abs(total_activities_weight - expected_activities_weight) < 0.01;

  // If there are no activities yet, show empty state
  if (filteredActivities.length === 0) {
    return (
      <div className="space-y-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">
              {t('planning.weightDistribution')}
            </h3>
            <BarChart3 className="h-5 w-5 text-gray-400" />
          </div>
          
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-sm text-gray-500">Initiative Weight</p>
              <p className="text-2xl font-semibold text-gray-900">{initiativeWeight}%</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Expected (65%)</p>
              <p className="text-2xl font-semibold text-blue-600">{expected_activities_weight}%</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Available</p>
              <p className="text-2xl font-semibold text-green-600">{expected_activities_weight}%</p>
            </div>
          </div>

          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-700 flex items-center">
              <Info className="h-4 w-4 mr-2" />
              <strong>Important:</strong> Main activities must have a combined weight of exactly {expected_activities_weight}% 
              (65% of initiative weight {initiativeWeight}%).
            </p>
          </div>
        </div>

        <div className="flex justify-between items-center">
          <h3 className="text-sm font-medium text-gray-700">Main Activities</h3>
        </div>

        <div className="text-center p-8 bg-white rounded-lg border-2 border-dashed border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Main Activities Found</h3>
          <p className="text-gray-500 mb-4">
            No main activities have been created yet for this initiative.
          </p>
          {isUserPlanner && (
            <button 
              onClick={() => onEditActivity({} as MainActivity)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
            >
              <PlusCircle className="h-4 w-4 mr-2" />
              Create First Main Activity
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            {t('planning.weightDistribution')}
          </h3>
          <BarChart3 className="h-5 w-5 text-gray-400" />
        </div>
        
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-sm text-gray-500">Initiative Weight</p>
            <p className="text-2xl font-semibold text-gray-900">{initiativeWeight}%</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Current Total</p>
            <p className="text-2xl font-semibold text-green-600">{total_activities_weight.toFixed(1)}%</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Remaining</p>
            <p className={`text-2xl font-semibold ${is_valid ? 'text-green-600' : remaining_weight < 0 ? 'text-red-600' : 'text-amber-600'}`}>
              {remaining_weight.toFixed(1)}%
            </p>
          </div>
        </div>

        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm text-blue-700 flex items-center">
            <Info className="h-4 w-4 mr-2" />
            <strong>Target:</strong> Main activities must total exactly {expected_activities_weight}% 
            (65% of initiative weight {initiativeWeight}%).
          </p>
        </div>

        {remaining_weight < 0 && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2 text-red-700">
            <AlertCircle className="h-5 w-5" />
            <p className="text-sm">Over target by {Math.abs(remaining_weight).toFixed(1)}%. Please reduce existing activity weights.</p>
          </div>
        )}

        {is_valid && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md flex items-center gap-2 text-green-700">
            <CheckCircle className="h-5 w-5" />
            <p className="text-sm">Weight distribution is perfect at {expected_activities_weight}%</p>
          </div>
        )}

        {validationSuccess && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md flex items-center gap-2 text-green-700">
            <CheckCircle className="h-5 w-5" />
            <p className="text-sm">{validationSuccess}</p>
          </div>
        )}

        {validationError && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2 text-red-700">
            <AlertCircle className="h-5 w-5" />
            <p className="text-sm">{validationError}</p>
          </div>
        )}

        {isUserPlanner && (
          <div className="mt-4">
            <button
              onClick={handleValidateActivities}
              disabled={filteredActivities.length === 0}
              className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
            >
              Validate Main Activities Weight
            </button>
          </div>
        )}
      </div>

      {/* Main Activities List */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-gray-700 flex items-center">
          <span className="inline-flex items-center px-2.5 py-0.5 mr-2 rounded-full text-xs font-medium bg-green-100 text-green-800">
            Activities ({filteredActivities.length})
          </span>
          Main Activities
        </h3>
        
        {filteredActivities.map((activity) => (
          <div
            key={activity.id}
            onClick={() => onSelectActivity && onSelectActivity(activity)}
            className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 hover:border-green-300 transition-colors cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center">
                <h4 className="font-medium text-gray-900">{activity.name}</h4>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-sm font-medium text-green-600">
                  {activity.weight}%
                </span>
              </div>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2 text-xs text-gray-500">
              <div>Baseline: {activity.baseline || 'N/A'}</div>
              <div>Annual Target: {activity.annual_target || 0}</div>
              <div>Q1: {activity.q1_target || 0}</div>
              <div>Q2: {activity.q2_target || 0}</div>
              <div>Q3: {activity.q3_target || 0}</div>
              <div>Q4: {activity.q4_target || 0}</div>
            </div>
            
            {/* Budget Summary */}
            {activity.budget && (
              <div className="mt-3 p-3 bg-gray-50 rounded-md border border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <DollarSign className="h-4 w-4 text-green-600 mr-1" />
                    <span className="text-sm font-medium text-gray-700">Budget</span>
                    {activity.budget.activity_type && (
                      <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                        {activity.budget.activity_type}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="text-sm font-medium text-green-600">
                      ${(activity.budget.budget_calculation_type === 'WITH_TOOL' 
                        ? activity.budget.estimated_cost_with_tool 
                        : activity.budget.estimated_cost_without_tool
                      ).toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-gray-500">
                  <div>Government: ${activity.budget.government_treasury.toLocaleString()}</div>
                  <div>Partners: ${activity.budget.partners_funding.toLocaleString()}</div>
                  <div>SDG: ${activity.budget.sdg_funding.toLocaleString()}</div>
                  <div>Other: ${activity.budget.other_funding.toLocaleString()}</div>
                </div>
                
                {/* Budget Action Buttons */}
                {isUserPlanner && (
                  <div className="mt-3 flex justify-end space-x-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onViewBudget) onViewBudget(activity);
                      }}
                      className="text-xs text-blue-600 hover:text-blue-800 flex items-center px-2 py-1 bg-blue-50 rounded"
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      View
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onEditBudget) onEditBudget(activity);
                      }}
                      className="text-xs text-purple-600 hover:text-purple-800 flex items-center px-2 py-1 bg-purple-50 rounded"
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      Edit
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm('Are you sure you want to delete this budget? The activity will remain but the budget will be removed.')) {
                          onDeleteBudget?.(activity.id);
                        }
                      }}
                      disabled={deletingBudgetId === activity.id}
                      className="text-xs text-red-600 hover:text-red-800 flex items-center px-2 py-1 bg-red-50 rounded disabled:opacity-50"
                    >
                      {deletingBudgetId === activity.id ? (
                        <>
                          <Loader className="h-3 w-3 mr-1 animate-spin" />
                          Deleting...
                        </>
                      ) : (
                        <>
                          <Trash2 className="h-3 w-3 mr-1" />
                          Delete
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
            
            <div className="flex justify-end mt-2">
              {isUserPlanner ? (
                <div className="flex space-x-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditActivity(activity);
                    }}
                    className="text-xs text-green-600 hover:text-green-800 flex items-center"
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </button>
                  
                  {/* Add Budget Button - Only show when no budget exists */}
                  {!activity.budget && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onAddBudget) onAddBudget(activity);
                      }}
                      className="text-xs text-blue-600 hover:text-blue-800 flex items-center"
                    >
                      <DollarSign className="h-4 w-4 mr-1" />
                      Add Budget
                    </button>
                  )}
                  
                  <button
                    onClick={(e) => handleDeleteActivity(activity.id, e)}
                    disabled={deleteActivityMutation.isPending}
                    className="text-xs text-red-600 hover:text-red-800 flex items-center disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </button>
                </div>
              ) : (
                <div className="text-xs text-gray-500 flex items-center">
                  <Lock className="h-3 w-3 mr-1" />
                  Read Only
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add main activity button */}
      {isUserPlanner && (
        <div className="mt-4 text-center">
          <button 
            onClick={() => onEditActivity({} as MainActivity)}
            disabled={remaining_weight <= 0.01}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <PlusCircle className="h-4 w-4 mr-2" />
            {filteredActivities.length === 0 ? 'Create First Main Activity' : 
             remaining_weight <= 0.01 ? `No Weight Available (${remaining_weight.toFixed(1)}%)` :
             'Create New Main Activity'}
          </button>
          
          {remaining_weight <= 0.01 && total_activities_weight < expected_activities_weight && (
            <p className="mt-2 text-xs text-amber-600">
              Cannot add more activities. Total weight must equal exactly {expected_activities_weight.toFixed(2)}%.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default MainActivityList;