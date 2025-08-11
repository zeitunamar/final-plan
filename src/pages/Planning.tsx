import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Target, Plus, Edit, Trash2, Eye, DollarSign, Send, ArrowLeft, AlertCircle, CheckCircle, Info, Loader, Building2, User, Calendar, FileType, RefreshCw, BarChart3 } from 'lucide-react';
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
import ObjectiveForm from '../components/ObjectiveForm';
import InitiativeForm from '../components/InitiativeForm';
import InitiativeList from '../components/InitiativeList';
import PerformanceMeasureForm from '../components/PerformanceMeasureForm';
import PerformanceMeasureList from '../components/PerformanceMeasureList';
import MainActivityForm from '../components/MainActivityForm';
import MainActivityList from '../components/MainActivityList';
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
import { isPlanner, isAdmin } from '../types/user';
import { format } from 'date-fns';

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
  const [showBudgetDetails, setShowBudgetDetails] = useState(false);
  const [selectedActivityForBudget, setSelectedActivityForBudget] = useState<MainActivity | null>(null);
  const [showBudgetCalculationModal, setShowBudgetCalculationModal] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewRefreshKey, setPreviewRefreshKey] = useState(0);
  const [selectedPerformanceMeasure, setSelectedPerformanceMeasure] = useState<PerformanceMeasure | null>(null);
  const [selectedMainActivity, setSelectedMainActivity] = useState<MainActivity | null>(null);
  const [showActivityTypeSelection, setShowActivityTypeSelection] = useState(false);
  const [selectedActivityType, setSelectedActivityType] = useState<ActivityType | null>(null);
  const [budgetCalculationType, setBudgetCalculationType] = useState<BudgetCalculationType>('WITHOUT_TOOL');
  const [isSubmittingPlan, setIsSubmittingPlan] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  // Get current user data
  const { data: authData } = useQuery({
    queryKey: ['auth'],
    queryFn: () => auth.getCurrentUser(),
    staleTime: 5 * 60 * 1000,
  });

  // Fetch organizations
  const { data: organizationsData, isLoading: isLoadingOrgs } = useQuery({
    queryKey: ['organizations'],
    queryFn: () => organizations.getAll(),
    enabled: !!authData?.isAuthenticated,
    staleTime: 5 * 60 * 1000,
  });

  // Get user organization info
  const userOrganization = organizationsData?.data?.find(
    (org: any) => authData?.userOrganizations?.some((userOrg: any) => userOrg.organization === org.id)
  );

  const plannerName = authData?.user ? 
    `${authData.user.first_name || ''} ${authData.user.last_name || ''}`.trim() || authData.user.username :
    'Unknown Planner';

  // Set default dates
  useEffect(() => {
    if (!fromDate || !toDate) {
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth();
      
      let fiscalYearStart, fiscalYearEnd;
      
      if (currentMonth >= 6) {
        fiscalYearStart = new Date(currentYear, 6, 1);
        fiscalYearEnd = new Date(currentYear + 1, 5, 30);
      } else {
        fiscalYearStart = new Date(currentYear - 1, 6, 1);
        fiscalYearEnd = new Date(currentYear, 5, 30);
      }
      
      setFromDate(fiscalYearStart.toISOString().split('T')[0]);
      setToDate(fiscalYearEnd.toISOString().split('T')[0]);
    }
  }, [fromDate, toDate]);

  // Event handlers
  const handleSelectPlanType = (type: PlanType) => {
    setPlanType(type);
    setCurrentStep('objectives');
  };

  const handleObjectivesSelected = (objectives: StrategicObjective[]) => {
    console.log('Objectives selected in Planning:', objectives);
    setSelectedObjectives(objectives);
  };

  const handleProceedToPlanning = () => {
    if (selectedObjectives.length === 0) {
      setSubmitError('Please select at least one objective before proceeding');
      return;
    }
    setCurrentStep('planning');
  };

  const handleSelectObjective = (objective: StrategicObjective) => {
    setSelectedObjective(objective);
    setSelectedInitiative(null);
  };

  const handleEditInitiative = (initiative: StrategicInitiative | any) => {
    if (initiative.id) {
      setSelectedInitiative(initiative);
    } else {
      setSelectedInitiative(null);
    }
    setShowInitiativeForm(true);
  };

  const handleEditPerformanceMeasure = (measure: PerformanceMeasure | any) => {
    if (measure.id) {
      setSelectedPerformanceMeasure(measure);
    } else {
      setSelectedPerformanceMeasure(null);
    }
    setShowPerformanceMeasureForm(true);
  };

  const handleEditMainActivity = (activity: MainActivity | any) => {
    if (activity.id) {
      setSelectedMainActivity(activity);
    } else {
      setSelectedMainActivity(null);
    }
    setShowMainActivityForm(true);
  };

  // Budget-related handlers
  const handleAddBudget = (activity: MainActivity) => {
    setSelectedActivityForBudget(activity);
    setShowActivityTypeSelection(true);
  };

  const handleSelectActivityType = (activityType: ActivityType) => {
    setSelectedActivityType(activityType);
    setShowActivityTypeSelection(false);
    setBudgetCalculationType('WITH_TOOL');
    setShowBudgetCalculationModal(true);
  };

  const handleManualBudgetEntry = () => {
    setSelectedActivityType(null);
    setShowActivityTypeSelection(false);
    setBudgetCalculationType('WITHOUT_TOOL');
    setShowBudgetForm(true);
  };

  const handleViewBudget = (activity: MainActivity) => {
    setSelectedActivityForBudget(activity);
    setShowBudgetDetails(true);
  };

  const handleEditBudget = (activity: MainActivity) => {
    setSelectedActivityForBudget(activity);
    if (activity.budget?.activity_type) {
      setSelectedActivityType(activity.budget.activity_type);
      setBudgetCalculationType(activity.budget.budget_calculation_type);
      if (activity.budget.budget_calculation_type === 'WITH_TOOL') {
        setShowBudgetCalculationModal(true);
      } else {
        setShowBudgetForm(true);
      }
    } else {
      setShowActivityTypeSelection(true);
    }
  };

  // Delete budget function - FIXED
  const handleDeleteBudget = async (budgetId: string) => {
    try {
      console.log('Deleting budget with ID:', budgetId);
      await activityBudgets.delete(budgetId);
      
      // Refresh the activities list to update UI immediately
      queryClient.invalidateQueries({ queryKey: ['main-activities'] });
      queryClient.invalidateQueries({ queryKey: ['activity-budgets'] });
      
      setSubmitSuccess('Budget deleted successfully');
      console.log('Budget deleted successfully with ID:', budgetId);
    } catch (error) {
      console.error('Error deleting budget:', error);
      setSubmitError('Failed to delete budget');
    }
  };

  // Submit handlers
  const handleInitiativeSubmit = async (data: any) => {
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

  const handlePerformanceMeasureSubmit = async (data: any) => {
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

  const handleMainActivitySubmit = async (data: any) => {
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

  const handleBudgetSubmit = async (budgetData: any) => {
    try {
      if (!selectedActivityForBudget?.id) {
        throw new Error('No activity selected for budget');
      }

      const activityId = selectedActivityForBudget.id;
      
      if (selectedActivityForBudget.budget?.id) {
        await activityBudgets.update(selectedActivityForBudget.budget.id, budgetData);
      } else {
        const budgetPayload = {
          ...budgetData,
          activity: activityId
        };
        await activityBudgets.create(budgetPayload);
      }
      
      queryClient.invalidateQueries({ queryKey: ['main-activities'] });
      queryClient.invalidateQueries({ queryKey: ['activity-budgets'] });
      
      setShowBudgetForm(false);
      setShowBudgetCalculationModal(false);
      setSelectedActivityForBudget(null);
      setSelectedActivityType(null);
    } catch (error) {
      console.error('Error saving budget:', error);
      throw error;
    }
  };

  const handleSubmitPlan = async () => {
    try {
      setIsSubmittingPlan(true);
      setSubmitError(null);

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

      let lastError;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await auth.getCurrentUser();
          const response = await plans.create(planData);
          
          setSubmitSuccess('Plan submitted successfully!');
          setTimeout(() => {
            navigate('/dashboard', { state: { activeTab: 'submitted' } });
          }, 2000);
          return;
        } catch (error: any) {
          lastError = error;
          if (attempt < 3) {
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          }
        }
      }
      
      throw lastError;
    } catch (error: any) {
      console.error('Error submitting plan:', error);
      setSubmitError(error.message || 'Failed to submit plan');
    } finally {
      setIsSubmittingPlan(false);
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
        ) || [];
        
        if (existingPlans.length > 0) {
          setSubmitError('You already have a submitted or approved plan. Only one plan per organization is allowed.');
        }
      } catch (error) {
        console.error('Error checking existing plans:', error);
      }
    };
    
    checkExistingPlans();
  }, [userOrganization?.id]);

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
        <div className="p-8 bg-red-50 border border-red-200 rounded-lg text-center max-w-md">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-red-800 mb-2">{t('planning.permissions.noAccess')}</h3>
          <p className="text-red-600 mb-4">{t('planning.permissions.plannerRequired')}</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!userOrganization) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="p-8 bg-yellow-50 border border-yellow-200 rounded-lg text-center max-w-md">
          <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-yellow-800 mb-2">No Organization Access</h3>
          <p className="text-yellow-600 mb-4">You don't have access to any organization for planning.</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2 bg-yellow-100 text-yellow-700 rounded-md hover:bg-yellow-200"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Strategic Planning</h1>
        <p className="text-gray-600">Create and manage your organization's strategic plan</p>
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
          
          <HorizontalObjectiveSelector
            onObjectivesSelected={handleObjectivesSelected}
            onProceed={handleProceedToPlanning}
            initialObjectives={selectedObjectives}
          />
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

          <div className="flex justify-between items-center">
            <button
              onClick={() => setCurrentStep('objectives')}
              className="flex items-center text-gray-600 hover:text-gray-900"
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
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                <Eye className="h-4 w-4 mr-2" />
                Preview Plan
              </button>
              <button
                onClick={() => setCurrentStep('review')}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Continue to Review
              </button>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <StrategicObjectivesList
              onSelectObjective={handleSelectObjective}
              selectedObjectiveId={selectedObjective?.id}
              selectedObjectives={selectedObjectives}
            />

            {selectedObjective && (
              <div className="mt-6 space-y-6">
                <div className="border-t border-gray-200 pt-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    Strategic Initiatives for: {selectedObjective.title}
                  </h3>
                  
                  <InitiativeList
                    parentId={selectedObjective.id.toString()}
                    parentType="objective"
                    parentWeight={selectedObjective.effective_weight || selectedObjective.planner_weight || selectedObjective.weight}
                    selectedObjectiveData={selectedObjective}
                    onEditInitiative={handleEditInitiative}
                    onSelectInitiative={setSelectedInitiative}
                    isUserPlanner={isPlanner(authData.userOrganizations)}
                    userOrgId={authData.userOrganizations?.[0]?.organization || null}
                  />
                </div>

                {selectedInitiative && (
                  <div className="border-t border-gray-200 pt-6">
                    <h4 className="text-lg font-medium text-gray-900 mb-4">
                      Performance Measures & Main Activities for: {selectedInitiative.name}
                    </h4>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div>
                        <h5 className="text-md font-medium text-gray-800 mb-3">Performance Measures</h5>
                        <PerformanceMeasureList
                          initiativeId={selectedInitiative.id}
                          initiativeWeight={selectedInitiative.weight}
                          onEditMeasure={handleEditPerformanceMeasure}
                          onSelectMeasure={setSelectedPerformanceMeasure}
                        />
                      </div>
                      
                      <div>
                        <h5 className="text-md font-medium text-gray-800 mb-3">Main Activities</h5>
                        <MainActivityList
                          initiativeId={selectedInitiative.id}
                          initiativeWeight={selectedInitiative.weight}
                          onEditActivity={handleEditMainActivity}
                          onSelectActivity={setSelectedMainActivity}
                          onAddBudget={handleAddBudget}
                          onViewBudget={handleViewBudget}
                          onEditBudget={handleEditBudget}
                          isUserPlanner={isPlanner(authData.userOrganizations)}
                          userOrgId={authData.userOrganizations?.[0]?.organization || null}
                          onDeleteBudget={(budgetId) => handleDeleteBudget(budgetId)}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Review Phase */}
      {currentStep === 'review' && (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Review & Submit Plan</h2>
            <button
              onClick={() => setCurrentStep('planning')}
              className="flex items-center text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-5 w-5 mr-1" />
              Back to Planning
            </button>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center">
                <Building2 className="h-5 w-5 text-gray-500 mr-2" />
                <div>
                  <p className="text-sm text-gray-500">Organization</p>
                  <p className="font-medium">{userOrganization?.name}</p>
                </div>
              </div>
              <div className="flex items-center">
                <User className="h-5 w-5 text-gray-500 mr-2" />
                <div>
                  <p className="text-sm text-gray-500">Planner</p>
                  <p className="font-medium">{plannerName}</p>
                </div>
              </div>
              <div className="flex items-center">
                <Calendar className="h-5 w-5 text-gray-500 mr-2" />
                <div>
                  <p className="text-sm text-gray-500">Period</p>
                  <p className="font-medium">{format(new Date(fromDate), 'MMM d')} - {format(new Date(toDate), 'MMM d, yyyy')}</p>
                </div>
              </div>
              <div className="flex items-center">
                <FileType className="h-5 w-5 text-gray-500 mr-2" />
                <div>
                  <p className="text-sm text-gray-500">Type</p>
                  <p className="font-medium">{planType}</p>
                </div>
              </div>
            </div>

            <div className="text-center">
              <button
                onClick={() => setShowSubmitModal(true)}
                disabled={selectedObjectives.length === 0 || isSubmittingPlan}
                className="px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 flex items-center mx-auto"
              >
                {isSubmittingPlan ? (
                  <>
                    <Loader className="h-4 w-4 mr-2 animate-spin" />
                    Submitting Plan...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Submit Plan for Review
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
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
              onSubmit={handleInitiativeSubmit}
              onCancel={() => {
                setShowInitiativeForm(false);
                setSelectedInitiative(null);
              }}
              initialData={selectedInitiative}
            />
          </div>
        </div>
      )}

      {showPerformanceMeasureForm && selectedInitiative && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {selectedPerformanceMeasure ? 'Edit Performance Measure' : 'Create Performance Measure'}
            </h3>
            <PerformanceMeasureForm
              initiativeId={selectedInitiative.id}
              currentTotal={0}
              onSubmit={handlePerformanceMeasureSubmit}
              onCancel={() => {
                setShowPerformanceMeasureForm(false);
                setSelectedPerformanceMeasure(null);
              }}
              initialData={selectedPerformanceMeasure}
            />
          </div>
        </div>
      )}

      {showMainActivityForm && selectedInitiative && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {selectedMainActivity ? 'Edit Main Activity' : 'Create Main Activity'}
            </h3>
            <MainActivityForm
              initiativeId={selectedInitiative.id}
              currentTotal={0}
              onSubmit={handleMainActivitySubmit}
              onCancel={() => {
                setShowMainActivityForm(false);
                setSelectedMainActivity(null);
              }}
              initialData={selectedMainActivity}
            />
          </div>
        </div>
      )}

      {/* Activity Type Selection Modal */}
      {showActivityTypeSelection && selectedActivityForBudget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Select Budget Calculation Method
            </h3>
            <p className="text-gray-600 mb-6">
              Choose how you want to calculate the budget for: {selectedActivityForBudget.name}
            </p>
            
            <div className="space-y-4">
              <button
                onClick={handleManualBudgetEntry}
                className="w-full p-4 text-left border border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50"
              >
                <div className="font-medium text-gray-900">Manual Entry</div>
                <div className="text-sm text-gray-500">Enter budget amounts manually</div>
              </button>
              
              <div className="text-center text-gray-500">or</div>
              
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">Use Costing Tool:</p>
                {(['Training', 'Meeting', 'Workshop', 'Printing', 'Procurement', 'Supervision'] as ActivityType[]).map(type => (
                  <button
                    key={type}
                    onClick={() => handleSelectActivityType(type)}
                    className="w-full p-3 text-left border border-gray-300 rounded-lg hover:border-green-500 hover:bg-green-50"
                  >
                    <div className="font-medium text-gray-900">{type}</div>
                    <div className="text-sm text-gray-500">Calculate costs using {type.toLowerCase()} tool</div>
                  </button>
                ))}
              </div>
            </div>
            
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => {
                  setShowActivityTypeSelection(false);
                  setSelectedActivityForBudget(null);
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Budget Calculation Modals */}
      {showBudgetCalculationModal && selectedActivityForBudget && selectedActivityType && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {selectedActivityType === 'Training' && (
              <TrainingCostingTool
                onCalculate={(costs) => {
                  setShowBudgetCalculationModal(false);
                  setShowBudgetForm(true);
                  handleBudgetSubmit(costs);
                }}
                onCancel={() => {
                  setShowBudgetCalculationModal(false);
                  setSelectedActivityForBudget(null);
                  setSelectedActivityType(null);
                }}
                initialData={selectedActivityForBudget.budget?.training_details}
              />
            )}
            
            {selectedActivityType === 'Meeting' && (
              <MeetingWorkshopCostingTool
                onCalculate={(costs) => {
                  setShowBudgetCalculationModal(false);
                  setShowBudgetForm(true);
                  handleBudgetSubmit(costs);
                }}
                onCancel={() => {
                  setShowBudgetCalculationModal(false);
                  setSelectedActivityForBudget(null);
                  setSelectedActivityType(null);
                }}
                initialData={selectedActivityForBudget.budget?.meeting_workshop_details}
              />
            )}
            
            {selectedActivityType === 'Workshop' && (
              <MeetingWorkshopCostingTool
                onCalculate={(costs) => {
                  setShowBudgetCalculationModal(false);
                  setShowBudgetForm(true);
                  handleBudgetSubmit(costs);
                }}
                onCancel={() => {
                  setShowBudgetCalculationModal(false);
                  setSelectedActivityForBudget(null);
                  setSelectedActivityType(null);
                }}
                initialData={selectedActivityForBudget.budget?.meeting_workshop_details}
              />
            )}
            
            {selectedActivityType === 'Printing' && (
              <PrintingCostingTool
                onCalculate={(costs) => {
                  setShowBudgetCalculationModal(false);
                  setShowBudgetForm(true);
                  handleBudgetSubmit(costs);
                }}
                onCancel={() => {
                  setShowBudgetCalculationModal(false);
                  setSelectedActivityForBudget(null);
                  setSelectedActivityType(null);
                }}
                initialData={selectedActivityForBudget.budget?.printing_details}
              />
            )}
            
            {selectedActivityType === 'Procurement' && (
              <ProcurementCostingTool
                onCalculate={(costs) => {
                  setShowBudgetCalculationModal(false);
                  setShowBudgetForm(true);
                  handleBudgetSubmit(costs);
                }}
                onCancel={() => {
                  setShowBudgetCalculationModal(false);
                  setSelectedActivityForBudget(null);
                  setSelectedActivityType(null);
                }}
                initialData={selectedActivityForBudget.budget?.procurement_details}
              />
            )}
            
            {selectedActivityType === 'Supervision' && (
              <SupervisionCostingTool
                onCalculate={(costs) => {
                  setShowBudgetCalculationModal(false);
                  setShowBudgetForm(true);
                  handleBudgetSubmit(costs);
                }}
                onCancel={() => {
                  setShowBudgetCalculationModal(false);
                  setSelectedActivityForBudget(null);
                  setSelectedActivityType(null);
                }}
                initialData={selectedActivityForBudget.budget?.supervision_details}
              />
            )}
          </div>
        </div>
      )}

      {/* Budget Form Modal */}
      {showBudgetForm && selectedActivityForBudget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Budget for: {selectedActivityForBudget.name}
            </h3>
            <ActivityBudgetForm
              activity={selectedActivityForBudget}
              budgetCalculationType={budgetCalculationType}
              activityType={selectedActivityType}
              onSubmit={handleBudgetSubmit}
              onCancel={() => {
                setShowBudgetForm(false);
                setSelectedActivityForBudget(null);
                setSelectedActivityType(null);
              }}
              initialData={selectedActivityForBudget.budget}
            />
          </div>
        </div>
      )}

      {/* Budget Details Modal */}
      {showBudgetDetails && selectedActivityForBudget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <ActivityBudgetDetails
              activity={selectedActivityForBudget}
              onBack={() => {
                setShowBudgetDetails(false);
                setSelectedActivityForBudget(null);
              }}
              onEdit={() => {
                setShowBudgetDetails(false);
                handleEditBudget(selectedActivityForBudget);
              }}
            />
          </div>
        </div>
      )}

      {/* Submit Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <PlanSubmitForm
              plan={{
                id: '',
                organization: userOrganization?.id?.toString() || '',
                planner_name: plannerName,
                type: planType,
                fiscal_year: new Date().getFullYear().toString(),
                from_date: fromDate,
                to_date: toDate,
                status: 'DRAFT',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              }}
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