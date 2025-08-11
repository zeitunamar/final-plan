import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Target, Plus, Edit, Trash2, Eye, DollarSign, Send, ArrowLeft, AlertCircle, CheckCircle, Info, Loader, Building2, User, Calendar, FileType, RefreshCw, BarChart3, Clock } from 'lucide-react';
import { useLanguage } from '../lib/i18n/LanguageContext';
import { 
  organizations, 
  objectives, 
  initiatives, 
  performanceMeasures, 
  mainActivities, 
  activityBudgets,
  plans,
  auth 
} from '../lib/api';
import type { 
  StrategicObjective, 
  StrategicInitiative, 
  PerformanceMeasure, 
  MainActivity 
} from '../types/organization';
import type { PlanType, ActivityType, BudgetCalculationType } from '../types/plan';
import PlanTypeSelector from '../components/PlanTypeSelector';
import PlanningHeader from '../components/PlanningHeader';
import InitiativeForm from '../components/InitiativeForm';
import PerformanceMeasureForm from '../components/PerformanceMeasureForm';
import MainActivityForm from '../components/MainActivityForm';
import ActivityBudgetForm from '../components/ActivityBudgetForm';
import TrainingCostingTool from '../components/TrainingCostingTool';
import MeetingWorkshopCostingTool from '../components/MeetingWorkshopCostingTool';
import PrintingCostingTool from '../components/PrintingCostingTool';
import ProcurementCostingTool from '../components/ProcurementCostingTool';
import SupervisionCostingTool from '../components/SupervisionCostingTool';
import PlanSubmitForm from '../components/PlanSubmitForm';
import PlanPreviewModal from '../components/PlanPreviewModal';
import ActivityBudgetDetails from '../components/ActivityBudgetDetails';
import HorizontalObjectiveSelector from '../components/HorizontalObjectiveSelector';
import StrategicObjectivesList from '../components/StrategicObjectivesList';
import InitiativeList from '../components/InitiativeList';
import PerformanceMeasureList from '../components/PerformanceMeasureList';
import MainActivityList from '../components/MainActivityList';
import { isPlanner, isAdmin } from '../types/user';
import { format } from 'date-fns';

// Plan status steps for progress indicator
const PLAN_STEPS = [
  { key: 'type', label: 'Plan Type', icon: FileType },
  { key: 'objectives', label: 'Objectives', icon: Target },
  { key: 'planning', label: 'Planning', icon: BarChart3 },
  { key: 'review', label: 'Review', icon: CheckCircle }
];

const Planning: React.FC = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // State management
  const [planType, setPlanType] = useState<PlanType>('LEO/EO Plan');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [currentStep, setCurrentStep] = useState<'type' | 'objectives' | 'planning' | 'review'>('type');
  const [selectedObjectives, setSelectedObjectives] = useState<StrategicObjective[]>([]);
  const [selectedObjective, setSelectedObjective] = useState<StrategicObjective | null>(null);
  const [selectedInitiative, setSelectedInitiative] = useState<StrategicInitiative | null>(null);
  const [showInitiativeForm, setShowInitiativeForm] = useState(false);
  const [showPerformanceMeasureForm, setShowPerformanceMeasureForm] = useState(false);
  const [showMainActivityForm, setShowMainActivityForm] = useState(false);
  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [showTrainingCostingTool, setShowTrainingCostingTool] = useState(false);
  const [showMeetingWorkshopCostingTool, setShowMeetingWorkshopCostingTool] = useState(false);
  const [showPrintingCostingTool, setShowPrintingCostingTool] = useState(false);
  const [showProcurementCostingTool, setShowProcurementCostingTool] = useState(false);
  const [showSupervisionCostingTool, setShowSupervisionCostingTool] = useState(false);
  const [selectedPerformanceMeasure, setSelectedPerformanceMeasure] = useState<PerformanceMeasure | null>(null);
  const [selectedMainActivity, setSelectedMainActivity] = useState<MainActivity | null>(null);
  const [showBudgetDetails, setShowBudgetDetails] = useState(false);
  const [selectedActivityForBudget, setSelectedActivityForBudget] = useState<MainActivity | null>(null);
  const [showBudgetCalculationModal, setShowBudgetCalculationModal] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewRefreshKey, setPreviewRefreshKey] = useState(0);
  const [budgetCalculationType, setBudgetCalculationType] = useState<BudgetCalculationType>('WITHOUT_TOOL');
  const [selectedActivityType, setSelectedActivityType] = useState<ActivityType | null>(null);
  const [costingToolData, setCostingToolData] = useState<any>(null);
  const [isSubmittingPlan, setIsSubmittingPlan] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [isLoadingObjectives, setIsLoadingObjectives] = useState(false);
  const [isSavingWeights, setIsSavingWeights] = useState(false);

  // Get current user data
  const { data: authData } = useQuery({
    queryKey: ['auth'],
    queryFn: () => auth.getCurrentUser(),
  });

  // Fetch organizations
  const { data: organizationsData, isLoading: isLoadingOrgs } = useQuery({
    queryKey: ['organizations'],
    queryFn: () => organizations.getAll(),
    enabled: !!authData?.isAuthenticated,
  });

  // Fetch objectives with performance optimization
  const { data: objectivesData, isLoading: isLoadingObjectivesData } = useQuery({
    queryKey: ['objectives', 'planning'],
    queryFn: async () => {
      try {
        setIsLoadingObjectives(true);
        const response = await objectives.getAll();
        return response;
      } catch (error) {
        console.error('Error fetching objectives:', error);
        throw error;
      } finally {
        setIsLoadingObjectives(false);
      }
    },
    enabled: !!authData?.isAuthenticated,
    retry: 2,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Get user organization info
  const userOrganization = organizationsData?.data?.find(
    (org: any) => authData?.userOrganizations?.some((userOrg: any) => userOrg.organization === org.id)
  );

  const plannerName = authData?.user?.first_name && authData?.user?.last_name 
    ? `${authData.user.first_name} ${authData.user.last_name}`
    : authData?.user?.username || 'Unknown Planner';

  // Event handlers
  const handleSelectPlanType = (type: PlanType) => {
    setPlanType(type);
    // Skip objective mode selection and go directly to custom objectives
    setCurrentStep('objectives');
  };

  const handleObjectivesSelected = (objectives: StrategicObjective[]) => {
    console.log('Objectives selected in Planning:', objectives);
    setSelectedObjectives(objectives);
    setIsLoadingObjectives(false);
  };

  const handleProceedToPlanning = () => {
    setCurrentStep('planning');
  };

  const handleSelectObjective = (objective: StrategicObjective) => {
    setSelectedObjective(objective);
    setSelectedInitiative(null);
  };

  const handleSelectInitiative = (initiative: StrategicInitiative) => {
    setSelectedInitiative(initiative);
  };

  // Initiative management
  const handleEditInitiative = (initiative?: StrategicInitiative) => {
    setSelectedInitiative(initiative || null);
    setShowInitiativeForm(true);
  };

  const handleSubmitInitiative = async (data: any) => {
    try {
      if (selectedInitiative?.id) {
        await initiatives.update(selectedInitiative.id, data);
      } else {
        await initiatives.create(data);
      }
      
      queryClient.invalidateQueries({ queryKey: ['initiatives'] });
      setShowInitiativeForm(false);
      setSelectedInitiative(null);
    } catch (error) {
      console.error('Error saving initiative:', error);
      throw error;
    }
  };

  // Performance measure management
  const handleEditPerformanceMeasure = (measure?: PerformanceMeasure) => {
    setSelectedPerformanceMeasure(measure || null);
    setShowPerformanceMeasureForm(true);
  };

  const handleSubmitPerformanceMeasure = async (data: any) => {
    try {
      if (selectedPerformanceMeasure?.id) {
        await performanceMeasures.update(selectedPerformanceMeasure.id, data);
      } else {
        await performanceMeasures.create(data);
      }
      
      queryClient.invalidateQueries({ queryKey: ['performance-measures'] });
      setShowPerformanceMeasureForm(false);
      setSelectedPerformanceMeasure(null);
    } catch (error) {
      console.error('Error saving performance measure:', error);
      throw error;
    }
  };

  // Main activity management
  const handleEditMainActivity = (activity?: MainActivity) => {
    setSelectedMainActivity(activity || null);
    setShowMainActivityForm(true);
  };

  const handleSubmitMainActivity = async (data: any) => {
    try {
      if (selectedMainActivity?.id) {
        await mainActivities.update(selectedMainActivity.id, data);
      } else {
        await mainActivities.create(data);
      }
      
      queryClient.invalidateQueries({ queryKey: ['main-activities'] });
      setShowMainActivityForm(false);
      setSelectedMainActivity(null);
    } catch (error) {
      console.error('Error saving main activity:', error);
      throw error;
    }
  };

  // Budget management
  const handleAddBudget = (activity: MainActivity) => {
    setSelectedActivityForBudget(activity);
    setShowBudgetCalculationModal(true);
  };

  const handleViewBudget = (activity: MainActivity) => {
    setSelectedActivityForBudget(activity);
    setShowBudgetDetails(true);
  };

  const handleEditBudget = (activity: MainActivity) => {
    setSelectedActivityForBudget(activity);
    setShowBudgetForm(true);
  };

  // Delete budget function
  const handleDeleteBudget = async (budgetId: string) => {
    try {
      console.log('Deleting budget with ID:', budgetId);
      await activityBudgets.delete(budgetId);
      
      // Refresh the activities list to update UI
      queryClient.invalidateQueries({ queryKey: ['main-activities'] });
      queryClient.invalidateQueries({ queryKey: ['activity-budgets'] });
      
      setSubmitSuccess('Budget deleted successfully');
      console.log('Budget deleted successfully with ID:', budgetId);
    } catch (error) {
      console.error('Error deleting budget:', error);
      setSubmitError('Failed to delete budget');
    }
  };

  const handleBudgetCalculationTypeSelect = (type: BudgetCalculationType, activityType?: ActivityType) => {
    setBudgetCalculationType(type);
    setSelectedActivityType(activityType || null);
    setShowBudgetCalculationModal(false);

    if (type === 'WITH_TOOL' && activityType) {
      // Show appropriate costing tool
      switch (activityType) {
        case 'Training':
          setShowTrainingCostingTool(true);
          break;
        case 'Meeting':
        case 'Workshop':
          setShowMeetingWorkshopCostingTool(true);
          break;
        case 'Printing':
          setShowPrintingCostingTool(true);
          break;
        case 'Procurement':
          setShowProcurementCostingTool(true);
          break;
        case 'Supervision':
          setShowSupervisionCostingTool(true);
          break;
        default:
          setShowBudgetForm(true);
      }
    } else {
      setShowBudgetForm(true);
    }
  };

  const handleCostingToolComplete = (costingData: any) => {
    setCostingToolData(costingData);
    setShowTrainingCostingTool(false);
    setShowMeetingWorkshopCostingTool(false);
    setShowPrintingCostingTool(false);
    setShowProcurementCostingTool(false);
    setShowSupervisionCostingTool(false);
    setShowBudgetForm(true);
  };

  const handleSubmitBudget = async (budgetData: any) => {
    try {
      if (!selectedActivityForBudget?.id) {
        throw new Error('No activity selected for budget');
      }

      // Check if budget already exists
      const existingBudgets = await activityBudgets.getByActivity(selectedActivityForBudget.id);
      const existingBudget = existingBudgets?.data?.[0];

      if (existingBudget) {
        // Update existing budget
        await activityBudgets.update(existingBudget.id, budgetData);
      } else {
        // Create new budget
        await activityBudgets.create(budgetData);
      }

      // Refresh queries
      queryClient.invalidateQueries({ queryKey: ['main-activities'] });
      queryClient.invalidateQueries({ queryKey: ['activity-budgets'] });
      
      // Close modals and reset state
      setShowBudgetForm(false);
      setSelectedActivityForBudget(null);
      setCostingToolData(null);
      setBudgetCalculationType('WITHOUT_TOOL');
      setSelectedActivityType(null);
      
      setSubmitSuccess('Budget saved successfully');
    } catch (error) {
      console.error('Error saving budget:', error);
      setSubmitError('Failed to save budget');
      throw error;
    }
  };

  // Plan submission
  const handleSubmitPlan = async () => {
    try {
      setIsSubmittingPlan(true);
      setSubmitError(null);
      
      // Validate total weight is exactly 100%
      const totalWeight = selectedObjectives.reduce((sum, obj) => {
        const effectiveWeight = obj.effective_weight || obj.planner_weight || obj.weight;
        return sum + effectiveWeight;
      }, 0);
      
      if (Math.abs(totalWeight - 100) >= 0.01) {
        setSubmitError(`Total objective weight must be exactly 100%. Current: ${totalWeight.toFixed(2)}%`);
        setIsSubmittingPlan(false);
        return;
      }

      // Prepare plan data with selected objectives and their weights
      const selectedObjectivesWeights: Record<string, number> = {};
      selectedObjectives.forEach(obj => {
        const effectiveWeight = obj.effective_weight || obj.planner_weight || obj.weight;
        selectedObjectivesWeights[obj.id] = effectiveWeight;
      });

      const planData = {
        organization: userOrganization?.id,
        planner_name: plannerName,
        type: planType,
        fiscal_year: new Date().getFullYear().toString(),
        from_date: fromDate,
        to_date: toDate,
        status: 'SUBMITTED',
        selected_objectives: selectedObjectives.map(obj => obj.id),
        selected_objectives_weights: selectedObjectivesWeights
      };

      console.log('Submitting plan with data:', planData);
      console.log('Selected objectives weights:', selectedObjectivesWeights);
      
      // Submit with retry logic for production reliability
      let lastError;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          console.log(`Plan submission attempt ${attempt}/3`);
          await auth.getCurrentUser();
          const result = await plans.create(planData);
          console.log('Plan submitted successfully:', result);
          
          setSubmitSuccess('Plan submitted successfully!');
          setShowSubmitModal(false);
          
          // Navigate to dashboard with submitted plans tab
          setTimeout(() => {
            navigate('/dashboard', { state: { activeTab: 'submitted' } });
          }, 2000);
          
          return;
        } catch (error: any) {
          lastError = error;
          console.error(`Plan submission attempt ${attempt} failed:`, error);
          
          if (attempt < 3) {
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          }
        }
      }
      
      throw lastError;
    } catch (error: any) {
      console.error('Plan submission failed:', error);
      setSubmitError(error.message || 'Failed to submit plan');
    } finally {
      setIsSubmittingPlan(false);
    }
  };

  // Enhanced objective selection with weight saving
  const handleObjectiveSelectionWithSave = async (objectives: StrategicObjective[]) => {
    try {
      setIsSavingWeights(true);
      setIsLoadingObjectives(true);
      
      // Save weights to database first
      for (const obj of objectives) {
        if (obj.is_default && obj.effective_weight !== obj.weight) {
          await objectives.update(obj.id.toString(), {
            planner_weight: obj.effective_weight
          });
        }
      }
      
      // Then update local state
      setSelectedObjectives(objectives);
      
    } catch (error) {
      console.error('Error saving objective weights:', error);
      setSubmitError('Failed to save objective weights');
    } finally {
      setIsSavingWeights(false);
      setIsLoadingObjectives(false);
    }
  };

  // Check for existing plans on component mount
  useEffect(() => {
    const checkExistingPlans = async () => {
      if (!userOrganization?.id) return;
      
      try {
        const response = await plans.getAll();
        const existingPlans = response?.data?.filter((plan: any) => 
          plan.organization === userOrganization.id && 
          ['SUBMITTED', 'APPROVED'].includes(plan.status)
        );
        
        if (existingPlans && existingPlans.length > 0) {
          setSubmitError('Your organization already has a submitted or approved plan. Only one plan per organization is allowed.');
        }
      } catch (error) {
        console.error('Error checking existing plans:', error);
      }
    };
    
    checkExistingPlans();
  }, [userOrganization?.id]);

  // Get current step index for progress indicator
  const getCurrentStepIndex = () => {
    return PLAN_STEPS.findIndex(step => step.key === currentStep);
  };

  if (isLoadingOrgs || !authData) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader className="h-6 w-6 animate-spin mr-2" />
        <div className="text-lg">{t('common.loading')}</div>
      </div>
    );
  }

  if (!isPlanner(authData.userOrganizations) && !isAdmin(authData.userOrganizations)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <AlertCircle className="h-12 w-12 text-amber-500 mb-4" />
        <h3 className="text-lg font-medium text-amber-800 mb-2">{t('planning.permissions.noAccess')}</h3>
        </button>
      </div>
    );
  }

  if (!userOrganization) {
    return (
        <button
          onClick={() => navigate('/dashboard')}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Strategic Planning</h1>
        <p className="text-gray-600">Create and manage your organization's strategic plan</p>
        
        {/* Progress Indicator */}
        <div className="mt-4">
          <div className="flex items-center justify-between">
            {PLAN_STEPS.map((step, index) => {
              const StepIcon = step.icon;
              const isActive = index === getCurrentStepIndex();
              const isCompleted = index < getCurrentStepIndex();
              
              return (
                <div key={step.key} className="flex items-center">
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                    isActive 
                      ? 'border-blue-600 bg-blue-600 text-white' 
                      : isCompleted 
                        ? 'border-green-600 bg-green-600 text-white'
                        : 'border-gray-300 bg-white text-gray-400'
                  }`}>
                    <StepIcon className="h-4 w-4" />
                  </div>
                  <span className={`ml-2 text-sm font-medium ${
                    isActive ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-400'
                  }`}>
                    {step.label}
                  </span>
                  {index < PLAN_STEPS.length - 1 && (
                    <div className={`ml-4 w-16 h-0.5 ${
                      isCompleted ? 'bg-green-600' : 'bg-gray-300'
                    }`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {submitError && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center text-red-700">
          <AlertCircle className="h-5 w-5 mr-2" />
          {submitError}
        </div>
      )}

      {submitSuccess && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center text-green-700">
          <CheckCircle className="h-5 w-5 mr-2" />
          {submitSuccess}
        </div>
      )}

      {/* Plan Type Selection */}
      {currentStep === 'type' && (
        <PlanTypeSelector onSelectPlanType={handleSelectPlanType} />
      )}

      {/* Objective Selection */}
      {currentStep === 'objectives' && (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Select Strategic Objectives</h2>
            <button
              onClick={() => setCurrentStep('type')}
              className="flex items-center text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-5 w-5 mr-1" />
              Back to Plan Type
            </button>
          </div>

          {(isLoadingObjectives || isSavingWeights) && (
            <div className="flex items-center justify-center p-8 bg-blue-50 rounded-lg border border-blue-200">
              <Loader className="h-6 w-6 animate-spin mr-3 text-blue-600" />
              <div className="text-blue-700">
                {isSavingWeights ? 'Saving objective weights...' : 'Loading objectives...'}
              </div>
            </div>
          )}

          {!isLoadingObjectives && !isSavingWeights && (
            <HorizontalObjectiveSelector
              onObjectivesSelected={handleObjectiveSelectionWithSave}
              onProceed={handleProceedToPlanning}
              initialObjectives={selectedObjectives}
            />
          )}
        </div>
      )}

      {/* Planning Phase */}
      {currentStep === 'planning' && (
        <div className="space-y-6">
          <PlanningHeader
            organizationName={userOrganization?.name || 'Unknown Organization'}
            fromDate={fromDate}
            toDate={toDate}
            plannerName={plannerName}
            planType={planType}
            onFromDateChange={setFromDate}
            onToDateChange={setToDate}
            onPlanTypeChange={setPlanType}
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <StrategicObjectivesList
                onSelectObjective={handleSelectObjective}
                selectedObjectiveId={selectedObjective?.id}
                selectedObjectives={selectedObjectives}
              />
            </div>

            <div className="lg:col-span-2 space-y-6">
              {selectedObjective && (
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    {selectedObjective.title}
                  </h3>
                  
                  <InitiativeList
                    parentId={selectedObjective.id.toString()}
                    parentType="objective"
                    parentWeight={selectedObjective.effective_weight || selectedObjective.planner_weight || selectedObjective.weight}
                    selectedObjectiveData={selectedObjective}
                    onEditInitiative={handleEditInitiative}
                    onSelectInitiative={handleSelectInitiative}
                    isUserPlanner={isPlanner(authData.userOrganizations)}
                    userOrgId={authData.userOrganizations?.[0]?.organization || null}
                  />
                </div>
              )}

              {selectedInitiative && (
                <div className="space-y-6">
                  <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">
                      Performance Measures for {selectedInitiative.name}
                    </h3>
                    
                    <PerformanceMeasureList
                      initiativeId={selectedInitiative.id}
                      initiativeWeight={selectedInitiative.weight}
                      onEditMeasure={handleEditPerformanceMeasure}
                      onSelectMeasure={setSelectedPerformanceMeasure}
                    />
                  </div>

                  <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">
                      Main Activities for {selectedInitiative.name}
                    </h3>
                    
                    <MainActivityList
                      initiativeId={selectedInitiative.id}
                      initiativeWeight={selectedInitiative.weight}
                      onEditActivity={handleEditMainActivity}
                      onSelectActivity={setSelectedMainActivity}
                      onAddBudget={handleAddBudget}
                      onViewBudget={handleViewBudget}
                      onEditBudget={handleEditBudget}
                      onDeleteBudget={(budgetId) => handleDeleteBudget(budgetId)}
                      isUserPlanner={isPlanner(authData.userOrganizations)}
                      userOrgId={authData.userOrganizations?.[0]?.organization || null}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-between">
            <button
              onClick={() => setCurrentStep('objectives')}
              className="flex items-center px-4 py-2 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-5 w-5 mr-1" />
              Back to Objectives
            </button>
            
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setPreviewRefreshKey(prev => prev + 1);
                  setShowPreviewModal(true);
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                <Eye className="h-4 w-4 mr-2 inline" />
                Preview Plan
              </button>
              
              <button
                onClick={() => setCurrentStep('review')}
                disabled={selectedObjectives.length === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                Continue to Review
                <ArrowLeft className="h-4 w-4 ml-2 rotate-180" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Review and Submit */}
      {currentStep === 'review' && (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Review and Submit Plan</h2>
            <button
              onClick={() => setCurrentStep('planning')}
              className="flex items-center text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-5 w-5 mr-1" />
              Back to Planning
            </button>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Plan Information</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Organization:</span>
                    <span className="font-medium">{userOrganization?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Planner:</span>
                    <span className="font-medium">{plannerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Plan Type:</span>
                    <span className="font-medium">{planType}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Period:</span>
                    <span className="font-medium">
                      {fromDate && toDate ? `${format(new Date(fromDate), 'MMM d, yyyy')} - ${format(new Date(toDate), 'MMM d, yyyy')}` : 'Not set'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Selected Objectives</h3>
                <div className="space-y-2">
                  {selectedObjectives.map(obj => (
                    <div key={obj.id} className="flex justify-between text-sm">
                      <span className="text-gray-600">{obj.title}:</span>
                      <span className="font-medium">{obj.effective_weight || obj.planner_weight || obj.weight}%</span>
                    </div>
                  ))}
                  <div className="pt-2 border-t border-gray-200 flex justify-between text-sm font-medium">
                    <span>Total Weight:</span>
                    <span className="text-green-600">
                      {selectedObjectives.reduce((sum, obj) => sum + (obj.effective_weight || obj.planner_weight || obj.weight), 0)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => {
                  setPreviewRefreshKey(prev => prev + 1);
                  setShowPreviewModal(true);
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                <Eye className="h-4 w-4 mr-2 inline" />
                Preview Plan
              </button>
              
              <button
                onClick={() => setShowSubmitModal(true)}
                disabled={!fromDate || !toDate || selectedObjectives.length === 0}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                <Send className="h-4 w-4 mr-2 inline" />
                Submit Plan for Review
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Initiative Form Modal */}
      {showInitiativeForm && selectedObjective && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {selectedInitiative ? 'Edit Initiative' : 'Create Initiative'}
            </h3>
            
            <InitiativeForm
              parentId={selectedObjective.id.toString()}
              parentType="objective"
              parentWeight={selectedObjective.effective_weight || selectedObjective.planner_weight || selectedObjective.weight}
              selectedObjectiveData={selectedObjective}
              currentTotal={0}
              onSubmit={handleSubmitInitiative}
              onCancel={() => {
                setShowInitiativeForm(false);
                setSelectedInitiative(null);
              }}
              initialData={selectedInitiative}
            />
          </div>
        </div>
      )}

      {/* Performance Measure Form Modal */}
      {showPerformanceMeasureForm && selectedInitiative && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {selectedPerformanceMeasure ? 'Edit Performance Measure' : 'Create Performance Measure'}
            </h3>
            
            <PerformanceMeasureForm
              initiativeId={selectedInitiative.id}
              currentTotal={0}
              onSubmit={handleSubmitPerformanceMeasure}
              onCancel={() => {
                setShowPerformanceMeasureForm(false);
                setSelectedPerformanceMeasure(null);
              }}
              initialData={selectedPerformanceMeasure}
            />
          </div>
        </div>
      )}

      {/* Main Activity Form Modal */}
      {showMainActivityForm && selectedInitiative && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {selectedMainActivity ? 'Edit Main Activity' : 'Create Main Activity'}
            </h3>
            
            <MainActivityForm
              initiativeId={selectedInitiative.id}
              currentTotal={0}
              onSubmit={handleSubmitMainActivity}
              onCancel={() => {
                setShowMainActivityForm(false);
                setSelectedMainActivity(null);
              }}
              initialData={selectedMainActivity}
            />
          </div>
        </div>
      )}

      {/* Budget Calculation Type Modal */}
      {showBudgetCalculationModal && selectedActivityForBudget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Budget Calculation for {selectedActivityForBudget.name}
            </h3>
            
            <div className="space-y-4">
              <button
                onClick={() => handleBudgetCalculationTypeSelect('WITHOUT_TOOL')}
                className="w-full p-4 text-left border border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50"
              >
                <div className="font-medium">Manual Entry</div>
                <div className="text-sm text-gray-500">Enter budget amounts manually</div>
              </button>
              
              <button
                onClick={() => {
                  setBudgetCalculationType('WITH_TOOL');
                  setShowBudgetCalculationModal(false);
                  // Show activity type selection
                  setShowActivityTypeSelection(true);
                }}
                className="w-full p-4 text-left border border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50"
              >
                <div className="font-medium">Use Costing Tool</div>
                <div className="text-sm text-gray-500">Calculate budget using activity-specific tools</div>
              </button>
            </div>
            
            <div className="flex justify-end mt-6">
              <button
                onClick={() => {
                  setShowBudgetCalculationModal(false);
                  setSelectedActivityForBudget(null);
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-900"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Activity Type Selection Modal */}
      {showActivityTypeSelection && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Select Activity Type
            </h3>
            
            <div className="grid grid-cols-1 gap-3">
              {(['Training', 'Meeting', 'Workshop', 'Printing', 'Procurement', 'Supervision', 'Other'] as ActivityType[]).map(type => (
                <button
                  key={type}
                  onClick={() => {
                    setSelectedActivityType(type);
                    setShowActivityTypeSelection(false);
                    handleBudgetCalculationTypeSelect('WITH_TOOL', type);
                  }}
                  className="p-3 text-left border border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50"
                >
                  <div className="font-medium">{type}</div>
                </button>
              ))}
            </div>
            
            <div className="flex justify-end mt-6">
              <button
                onClick={() => {
                  setShowActivityTypeSelection(false);
                  setShowBudgetCalculationModal(true);
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-900"
              >
                Back
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Training Costing Tool Modal */}
      {showTrainingCostingTool && selectedActivityForBudget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <TrainingCostingTool
              onCalculate={handleCostingToolComplete}
              onCancel={() => {
                setShowTrainingCostingTool(false);
                setSelectedActivityForBudget(null);
                setCostingToolData(null);
              }}
            />
          </div>
        </div>
      )}

      {/* Meeting/Workshop Costing Tool Modal */}
      {showMeetingWorkshopCostingTool && selectedActivityForBudget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <MeetingWorkshopCostingTool
              onCalculate={handleCostingToolComplete}
              onCancel={() => {
                setShowMeetingWorkshopCostingTool(false);
                setSelectedActivityForBudget(null);
                setCostingToolData(null);
              }}
            />
          </div>
        </div>
      )}

      {/* Printing Costing Tool Modal */}
      {showPrintingCostingTool && selectedActivityForBudget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <PrintingCostingTool
              onCalculate={handleCostingToolComplete}
              onCancel={() => {
                setShowPrintingCostingTool(false);
                setSelectedActivityForBudget(null);
                setCostingToolData(null);
              }}
            />
          </div>
        </div>
      )}

      {/* Procurement Costing Tool Modal */}
      {showProcurementCostingTool && selectedActivityForBudget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <ProcurementCostingTool
              onCalculate={handleCostingToolComplete}
              onCancel={() => {
                setShowProcurementCostingTool(false);
                setSelectedActivityForBudget(null);
                setCostingToolData(null);
              }}
            />
          </div>
        </div>
      )}

      {/* Supervision Costing Tool Modal */}
      {showSupervisionCostingTool && selectedActivityForBudget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <SupervisionCostingTool
              onCalculate={handleCostingToolComplete}
              onCancel={() => {
                setShowSupervisionCostingTool(false);
                setSelectedActivityForBudget(null);
                setCostingToolData(null);
              }}
            />
          </div>
        </div>
      )}

      {/* Budget Form Modal */}
      {showBudgetForm && selectedActivityForBudget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Budget for {selectedActivityForBudget.name}
              </h3>
              
              <ActivityBudgetForm
                activity={selectedActivityForBudget}
                budgetCalculationType={budgetCalculationType}
                activityType={selectedActivityType}
                onSubmit={handleSubmitBudget}
                onCancel={() => {
                  setShowBudgetForm(false);
                  setSelectedActivityForBudget(null);
                  setCostingToolData(null);
                  setBudgetCalculationType('WITHOUT_TOOL');
                  setSelectedActivityType(null);
                }}
                initialData={costingToolData}
              />
            </div>
          </div>
        </div>
      )}

      {/* Budget Details Modal */}
      {showBudgetDetails && selectedActivityForBudget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <ActivityBudgetDetails
                activity={selectedActivityForBudget}
                onBack={() => {
                  setShowBudgetDetails(false);
                  setSelectedActivityForBudget(null);
                }}
                onEdit={() => {
                  setShowBudgetDetails(false);
                  setShowBudgetForm(true);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Submit Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <PlanSubmitForm
              plan={{
                organization: userOrganization?.id || 0,
                planner_name: plannerName,
                type: planType,
                fiscal_year: new Date().getFullYear().toString(),
                from_date: fromDate,
                to_date: toDate,
                status: 'DRAFT'
              } as any}
              onSubmit={handleSubmitPlan}
              onCancel={() => setShowSubmitModal(false)}
              isSubmitting={isSubmittingPlan}
            />
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreviewModal && (
        <PlanPreviewModal
          isOpen={showPreviewModal}
          onClose={() => setShowPreviewModal(false)}
          objectives={selectedObjectives}
          organizationName={userOrganization?.name || 'Unknown Organization'}
          plannerName={plannerName}
          fromDate={fromDate}
          toDate={toDate}
          planType={planType}
          refreshKey={previewRefreshKey}
        />
      )}
    </div>
  );
};

export default Planning;