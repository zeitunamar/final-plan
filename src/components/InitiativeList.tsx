import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { initiatives } from '../lib/api';
import { BarChart3, AlertCircle, CheckCircle, Edit, Trash2, Lock, PlusCircle, Building2, Info } from 'lucide-react';
import { useLanguage } from '../lib/i18n/LanguageContext';
import type { StrategicInitiative } from '../types/organization';
import { auth } from '../lib/api';
import { isPlanner } from '../types/user';

interface InitiativeListProps {
  parentId: string;
  parentType: 'objective' | 'program' | 'subprogram';
  parentWeight: number;  // The weight of the parent (objective, program, subprogram)
  onEditInitiative: (initiative: StrategicInitiative) => void;
  onSelectInitiative?: (initiative: StrategicInitiative) => void;
  isNewPlan?: boolean;
  planKey?: string; // Add plan key to force refresh
  isUserPlanner: boolean;  // Add this prop
  userOrgId: number | null; // Add this prop
}

const InitiativeList: React.FC<InitiativeListProps> = ({ 
  parentId,
  parentType,
  parentWeight,
  onEditInitiative,
  onSelectInitiative,
  isNewPlan = false,
  planKey = 'default',
  isUserPlanner,
  userOrgId,
  
}) => {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  // const [isUserPlanner, setIsUserPlanner] = React.useState(false);
  // const [userOrgId, setUserOrgId] = React.useState<number | null>(null);
  
  // Fetch current user role and organization
  // React.useEffect(() => {
  //   const fetchUserData = async () => {
  //     try {
  //       const authData = await auth.getCurrentUser();
  //       setIsUserPlanner(isPlanner(authData.userOrganizations));
        
  //       // Get the user's primary organization ID
  //       if (authData.userOrganizations && authData.userOrganizations.length > 0) {
  //         setUserOrgId(authData.userOrganizations[0].organization);
  //       }
  //     } catch (error) {
  //       console.error('Failed to fetch user data:', error);
  //     }
  //   };
    
  //   fetchUserData();
  // }, []);

  // Fetch weight summary based on parent type
  const { data: weightSummary, isLoading: isLoadingSummary } = useQuery({
    queryKey: ['initiatives', 'weight-summary', parentId, parentType, planKey],
    queryFn: () => initiatives.getWeightSummary(parentId, parentType),
    enabled: !!parentId, // Only fetch when parentId is available
    staleTime: 0, // Don't cache
    cacheTime: 0 // Don't cache at all
  });

  // Fetch all initiatives based on parent type
  const { data: initiativesList, isLoading } = useQuery({
    queryKey: ['initiatives', parentId, parentType, planKey],
    queryFn: async () => {
      if (!parentId) {
        console.log('Missing parentId, cannot fetch initiatives');
        return { data: [] };
      }
      
      console.log(`Fetching initiatives for ${parentType} ${parentId}`);
      let response;
      switch (parentType) {
        case 'objective':
          response = await initiatives.getByObjective(parentId);
          break;
        case 'program':
          response = await initiatives.getByProgram(parentId);
          break;
        case 'subprogram':
          response = await initiatives.getBySubProgram(parentId);
          break;
        default:
          throw new Error('Invalid parent type');
      }

      console.log('Fetched initiatives:', response.data);
      return response;
    },
    enabled: !!parentId, // Only fetch when parentId is available
    staleTime: 0, // Don't cache the data
    cacheTime: 0,  // Don't store data in cache at all
  });

  const validateInitiativesMutation = useMutation({
    mutationFn: () => initiatives.validateInitiativesWeight(parentId, parentType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['initiatives', 'weight-summary', parentId, parentType, planKey] });
    }
  });

  // Add delete initiative mutation
  const deleteInitiativeMutation = useMutation({
    mutationFn: (initiativeId: string) => initiatives.delete(initiativeId),
    onSuccess: () => {
      // Refresh initiatives list and weight summary after deletion
      queryClient.invalidateQueries({ queryKey: ['initiatives', parentId, parentType] });
      queryClient.invalidateQueries({ queryKey: ['initiatives', 'weight-summary', parentId, parentType, planKey] });
    }
  });

  // Handle initiative deletion
  const handleDeleteInitiative = (initiativeId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent initiative selection
    
    if (window.confirm('Are you sure you want to delete this initiative? This action cannot be undone.')) {
      deleteInitiativeMutation.mutate(initiativeId);
    }
  };

  const handleSelectObjective = (objective: StrategicObjective) => {
    console.log('Objective selected:', objective);
    // Ensure we use the effective weight (custom weight if available)
    const objectiveWithEffectiveWeight = {
      ...objective,
      effective_weight: objective.effective_weight || objective.planner_weight || objective.weight
    };
    setSelectedObjective(objectiveWithEffectiveWeight);
    setSelectedProgram(null);
    setSelectedInitiative(null);
  };

  // Calculate the effective weight based on parent objective weight
  const getEffectiveWeight = (weight: number): number => {
    // If parent weight is 100%, return the weight as is
    if (parentWeight === 100) return weight;
    
    // Otherwise, calculate the effective weight (percentage of parent weight)
    return (weight / 100) * parentWeight;
  };

  if (isLoading && parentId) {
    return <div className="text-center p-4">{t('common.loading')}</div>;
  }

  if (!initiativesList?.data) {
    return null;
  }

  console.log('Initiatives data:', initiativesList.data);

  // Calculate weight totals from actual initiatives data
  const filteredInitiatives = initiativesList.data.filter(i => 
    i.is_default || !i.organization || i.organization === userOrgId
  );
  
  const total_initiatives_weight = filteredInitiatives.reduce((sum, initiative) => 
    sum + (Number(initiative.weight) || 0), 0
  );
  
  const remaining_weight = parentWeight - total_initiatives_weight;
  
  // Check if exactly equal to parent weight with a small epsilon for floating point comparison
  // For objectives, weight must be exactly equal to parent weight
  // For programs, weight just needs to not exceed parent weight
  const is_valid = parentType === 'objective' 
    ? Math.abs(total_initiatives_weight - parentWeight) < 0.01 
    : total_initiatives_weight <= parentWeight;

  // Group initiatives by default vs custom
  const defaultInitiatives = initiativesList.data.filter(i => i.is_default);
  // Filter custom initiatives to only show those belonging to the user's organization or default ones
  const customInitiatives = initiativesList.data.filter(i => 
    !i.is_default && (i.organization === userOrgId || !i.organization));

  console.log('Default initiatives:', defaultInitiatives.length);
  console.log('Custom initiatives:', customInitiatives.length);
  console.log('User organization ID:', userOrgId);
  console.log('Weight calculation:', {
    parentWeight,
    total_initiatives_weight,
    remaining_weight,
    is_valid,
    filteredInitiativesCount: filteredInitiatives.length
  });

  // If there are no initiatives yet, show empty state
  if (initiativesList.data.length === 0) {
    return (
      <div className="space-y-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">
              {t('planning.weightDistribution')}
            </h3>
            <BarChart3 className="h-5 w-5 text-gray-400" />
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-sm text-gray-500">{t('planning.allocatedWeight')}</p>
              <p className="text-2xl font-semibold text-blue-600">0%</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">{t('planning.remainingWeight')}</p>
              <p className="text-2xl font-semibold text-green-600">{parentWeight}%</p>
            </div>
          </div>

          {parentType === 'objective' && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-700 flex items-center">
                <Info className="h-4 w-4 mr-2" />
                <strong>Important:</strong> For this objective with weight {parentWeight}%, 
                the total initiative weights must equal <strong>exactly {parentWeight}%</strong>.
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-between items-center">
          <h3 className="text-sm font-medium text-gray-700">Initiatives</h3>
        </div>

        <div className="text-center p-8 bg-white rounded-lg border-2 border-dashed border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Initiatives Found</h3>
          <p className="text-gray-500 mb-4">
            No initiatives have been created yet for this {parentType}.
          </p>
          {isUserPlanner && (
            <button 
              onClick={() => onEditInitiative({})}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
            >
              <PlusCircle className="h-4 w-4 mr-2" />
              Create Initiative
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
            <p className="text-sm text-gray-500">Parent Weight</p>
            <p className="text-2xl font-semibold text-gray-900">{parentWeight}%</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">{t('planning.allocatedWeight')}</p>
            <p className="text-2xl font-semibold text-blue-600">{total_initiatives_weight.toFixed(1)}%</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">{t('planning.remainingWeight')}</p>
            <p className={`text-2xl font-semibold ${is_valid ? 'text-green-600' : remaining_weight < 0 ? 'text-red-600' : 'text-amber-600'}`}>
              {remaining_weight.toFixed(1)}%
            </p>
          </div>
        </div>

        {parentType === 'objective' && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-700 flex items-center">
              <Info className="h-4 w-4 mr-2" />
              <strong>Important:</strong> For this objective with weight {parentWeight}%, 
              the total initiative weights must equal <strong>exactly {parentWeight}%</strong>.
            </p>
          </div>
        )}

        {remaining_weight < 0 && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2 text-red-700">
            <AlertCircle className="h-5 w-5" />
            <p className="text-sm">{t('planning.overAllocatedWarning')}</p>
          </div>
        )}

        {remaining_weight > 0 && parentType === 'objective' && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-md flex items-center gap-2 text-amber-700">
            <AlertCircle className="h-5 w-5" />
            <p className="text-sm">
              Total weight must equal exactly {parentWeight}%. 
              Current total: {total_initiatives_weight.toFixed(1)}%
            </p>
          </div>
        )}

        {is_valid && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md flex items-center gap-2 text-green-700">
            <CheckCircle className="h-5 w-5" />
            <p className="text-sm">
              {parentType === 'objective' 
                ? `Weight distribution is balanced at exactly ${parentWeight}%` 
                : 'Weight distribution is valid'}
            </p>
          </div>
        )}

        {isUserPlanner && (
          <div className="mt-4">
            <button
              onClick={() => validateInitiativesMutation.mutate()}
              disabled={validateInitiativesMutation.isPending || isLoadingSummary}
              className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {validateInitiativesMutation.isPending ? 'Validating...' : 'Validate Initiatives Weight'}
            </button>
            
            {validateInitiativesMutation.isError && (
              <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
                {(validateInitiativesMutation.error as any)?.response?.data?.message || 
                  'Failed to validate initiatives weight'}
              </div>
            )}
            
            {validateInitiativesMutation.isSuccess && (
              <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-md text-sm text-green-700">
                {validateInitiativesMutation.data?.data?.message || 'Initiatives weight validated successfully'}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Default Initiatives */}
      {defaultInitiatives.length > 0 && (
        <>
          <h3 className="text-sm font-medium text-gray-700 flex items-center">
            <span className="inline-flex items-center px-2.5 py-0.5 mr-2 rounded-full text-xs font-medium bg-green-100 text-green-800">
              Default
            </span>
            Default Initiatives
          </h3>
          <div className="space-y-2">
            {defaultInitiatives.map((initiative) => (
              <div
                key={initiative.id}
                onClick={() => onSelectInitiative && onSelectInitiative(initiative)}
                className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 hover:border-green-300 transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center">
                    <h4 className="font-medium text-gray-900">{initiative.name}</h4>
                    <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Default
                    </span>
                    {initiative.initiative_feed && (
                      <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        Predefined
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-sm font-medium text-blue-600">
                      {initiative.weight}%
                    </span>
                    {parentWeight < 100 && (
                      <span className="text-xs text-gray-500">
                        (Effective: {getEffectiveWeight(initiative.weight).toFixed(1)}%)
                      </span>
                    )}
                  </div>
                </div>
                
                {initiative.organization_name && (
                  <div className="mb-2 flex items-center text-sm text-gray-600">
                    <Building2 className="h-4 w-4 mr-1 text-gray-500" />
                    <span>{initiative.organization_name}</span>
                  </div>
                )}
                
                <div className="flex justify-end mt-2">
                  {isUserPlanner ? (
                    <div className="flex space-x-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent initiative selection when clicking edit
                          onEditInitiative(initiative);
                        }}
                        className="text-xs text-blue-600 hover:text-blue-800 flex items-center"
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </button>
                      <button
                        onClick={(e) => handleDeleteInitiative(initiative.id, e)}
                        className="text-xs text-red-600 hover:text-red-800 flex items-center"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </button>
                    </div>
                  ) : (
                    <div className="text-xs text-gray-500 flex items-center">
                      <Lock className="h-3 w-3 mr-1" />
                      {t('planning.permissions.readOnly')}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Custom Initiatives */}
      {customInitiatives.length > 0 && (
        <>
          <h3 className="text-sm font-medium text-gray-700 flex items-center mt-6">
            <span className="inline-flex items-center px-2.5 py-0.5 mr-2 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              Custom
            </span>
            Your Initiatives
          </h3>
          <div className="space-y-2">
            {customInitiatives.map((initiative) => (
              <div
                key={initiative.id}
                onClick={() => onSelectInitiative && onSelectInitiative(initiative)}
                className="bg-white p-4 rounded-lg shadow-sm border border-blue-200 hover:border-blue-400 transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center">
                    <h4 className="font-medium text-gray-900">{initiative.name}</h4>
                    {initiative.initiative_feed && (
                      <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        Predefined
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-sm font-medium text-blue-600">
                      {initiative.weight}%
                    </span>
                    {parentWeight < 100 && (
                      <span className="text-xs text-gray-500">
                        (Effective: {getEffectiveWeight(initiative.weight).toFixed(1)}%)
                      </span>
                    )}
                  </div>
                </div>
                
                {initiative.organization_name && (
                  <div className="mb-2 flex items-center text-sm text-gray-600">
                    <Building2 className="h-4 w-4 mr-1 text-gray-500" />
                    <span>{initiative.organization_name}</span>
                  </div>
                )}
                
                <div className="flex justify-end mt-2">
                  {isUserPlanner ? (
                    <div className="flex space-x-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent initiative selection when clicking edit
                          onEditInitiative(initiative);
                        }}
                        className="text-xs text-blue-600 hover:text-blue-800 flex items-center"
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </button>
                      <button
                        onClick={(e) => handleDeleteInitiative(initiative.id, e)}
                        className="text-xs text-red-600 hover:text-red-800 flex items-center"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </button>
                    </div>
                  ) : (
                    <div className="text-xs text-gray-500 flex items-center">
                      <Lock className="h-3 w-3 mr-1" />
                      {t('planning.permissions.readOnly')}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Add initiative button */}
      {isUserPlanner && (
        <div className="mt-4 text-center">
          <button 
            onClick={() => onEditInitiative({})}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
          >
            <PlusCircle className="h-4 w-4 mr-2" />
            {initiativesList.data.length === 0 ? 'Create First Initiative' : 'Create New Initiative'}
          </button>
        </div>
      )}
    </div>
  );
};

export default InitiativeList;