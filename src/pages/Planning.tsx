import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { 
  Target, 
  Plus, 
  Edit, 
  Trash2, 
  Save, 
  Loader, 
  AlertCircle, 
  CheckCircle, 
  ArrowLeft, 
  ArrowRight, 
  Eye, 
  Send,
  Calculator,
  DollarSign,
  Activity,
  BarChart3,
  FileSpreadsheet,
  Building2,
  User,
  Calendar,
  FileType,
  Info,
  RefreshCw
} from 'lucide-react';
import { useLanguage } from '../lib/i18n/LanguageContext';
import { 
  organizations, 
  objectives, 
  programs, 
  initiatives, 
  performanceMeasures, 
  mainActivities, 
  plans, 
  auth,
  activityBudgets,
  api
} from '../lib/api';
import type { 
  Organization, 
  StrategicObjective, 
  Program, 
  StrategicInitiative 
} from '../types/organization';
import type { 
  Plan, 
  PlanType, 
  MainActivity, 
  PerformanceMeasure, 
  ActivityBudget, 
  BudgetCalculationType, 
  ActivityType 
} from '../types/plan';
import { isPlanner, isAdmin } from '../types/user';

// Component imports
import PlanTypeSelector from '../components/PlanTypeSelector';
import ObjectiveSelectionMode from '../components/ObjectiveSelectionMode';
import HorizontalObjectiveSelector from '../components/HorizontalObjectiveSelector';
import StrategicObjectivesList from '../components/StrategicObjectivesList';
import InitiativeList from '../components/InitiativeList';
import InitiativeForm from '../components/InitiativeForm';
import PerformanceMeasureList from '../components/PerformanceMeasureList';
import PerformanceMeasureForm from '../components/PerformanceMeasureForm';
import MainActivityList from '../components/MainActivityList';
import MainActivityForm from '../components/MainActivityForm';
import ActivityBudgetForm from '../components/ActivityBudgetForm';
import ActivityBudgetDetails from '../components/ActivityBudgetDetails';
import ActivityBudgetSummary from '../components/ActivityBudgetSummary';
import PlanReviewTable from '../components/PlanReviewTable';
import PlanSubmitForm from '../components/PlanSubmitForm';
import PlanPreviewModal from '../components/PlanPreviewModal';
import PlanningHeader from '../components/PlanningHeader';

// Costing tool imports
import TrainingCostingTool from '../components/TrainingCostingTool';
import MeetingWorkshopCostingTool from '../components/MeetingWorkshopCostingTool';
import SupervisionCostingTool from '../components/SupervisionCostingTool';
import PrintingCostingTool from '../components/PrintingCostingTool';
import ProcurementCostingTool from '../components/ProcurementCostingTool';

type PlanningStep = 
  | 'plan-type' 
  | 'objective-selection' 
  | 'planning' 
  | 'review' 
  | 'submit';


const Planning: React.FC = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Core state
  const [currentStep, setCurrentStep] = useState<PlanningStep>('plan-type');
  const [selectedPlanType, setSelectedPlanType] = useState<PlanType>('LEO/EO Plan');
  const [selectedObjectives, setSelectedObjectives] = useState<StrategicObjective[]>([]);
  const [selectedObjective, setSelectedObjective] = useState<StrategicObjective | null>(null);
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null);
  const [selectedInitiative, setSelectedInitiative] = useState<StrategicInitiative | null>(null);
  
  // User and organization state
  const [userOrganization, setUserOrganization] = useState<Organization | null>(null);
  const [plannerName, setPlannerName] = useState<string>('');
  const [isUserPlanner, setIsUserPlanner] = useState(false);
  const [userOrgId, setUserOrgId] = useState<number | null>(null);
  
  // Planning period state
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  
  // Form and UI state
  const [showInitiativeForm, setShowInitiativeForm] = useState(false);
  const [showMeasureForm, setShowMeasureForm] = useState(false);
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [showBudgetDetails, setShowBudgetDetails] = useState(false);
  const [showCostingTool, setShowCostingTool] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  
  // Edit state
  const [editingInitiative, setEditingInitiative] = useState<StrategicInitiative | null>(null);
  const [editingMeasure, setEditingMeasure] = useState<PerformanceMeasure | null>(null);
  const [editingActivity, setEditingActivity] = useState<MainActivity | null>(null);
  const [editingBudget, setEditingBudget] = useState<ActivityBudget | null>(null);
  
  // Budget and costing state
  const [selectedActivity, setSelectedActivity] = useState<MainActivity | null>(null);
  const [budgetCalculationType, setBudgetCalculationType] = useState<BudgetCalculationType>('WITHOUT_TOOL');
  const [selectedActivityType, setSelectedActivityType] = useState<ActivityType | null>(null);
  const [costingToolData, setCostingToolData] = useState<any>(null);
  
  // Error and loading state
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch current user and organization
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const authData = await auth.getCurrentUser();
        if (!authData.isAuthenticated) {
          navigate('/login');
          return;
        }
        
        setIsUserPlanner(isPlanner(authData.userOrganizations));
        
        if (authData.userOrganizations && authData.userOrganizations.length > 0) {
          const userOrg = authData.userOrganizations[0];
          setUserOrgId(userOrg.organization);
          
          // Fetch organization details
          try {
            const orgData = await organizations.getById(userOrg.organization.toString());
            setUserOrganization(orgData);
          } catch (orgError) {
            console.error('Failed to fetch organization details:', orgError);
          }
        }
        
        // Set planner name
        const fullName = `${authData.user?.first_name || ''} ${authData.user?.last_name || ''}`.trim();
        setPlannerName(fullName || authData.user?.username || 'Unknown Planner');
        
        // Set default dates (current fiscal year)
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const fiscalYearStart = new Date(currentYear, 6, 1); // July 1st
        const fiscalYearEnd = new Date(currentYear + 1, 5, 30); // June 30th next year
        
        setFromDate(fiscalYearStart.toISOString().split('T')[0]);
        setToDate(fiscalYearEnd.toISOString().split('T')[0]);
        
      } catch (error) {
        console.error('Failed to fetch user data:', error);
        setError('Failed to load user information');
      }
    };
    
    fetchUserData();
  }, [navigate]);

  // Check permissions
  if (!isUserPlanner && !isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center p-8 bg-yellow-50 rounded-lg border border-yellow-200">
          <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-yellow-800 mb-2">Access Restricted</h3>
          <p className="text-yellow-600">{t('planning.permissions.plannerRequired')}</p>
        </div>
      </div>
    );
  }

  // Step handlers
  const handlePlanTypeSelect = (type: PlanType) => {
    setSelectedPlanType(type);
    setCurrentStep('objective-selection');
  };


  const handleObjectivesSelected = (objectives: StrategicObjective[]) => {
    console.log('Objectives selected in Planning:', objectives);
    setSelectedObjectives(objectives);
    
    // If only one objective, auto-select it
    if (objectives.length === 1) {
      setSelectedObjective(objectives[0]);
    }
  };

  const handleProceedToPlanning = () => {
    console.log('Proceeding to planning with objectives:', selectedObjectives);
    setCurrentStep('planning');
  };

  const handleSelectObjective = (objective: StrategicObjective) => {
    console.log('Objective selected:', objective);
    setSelectedObjective(objective);
    setSelectedProgram(null);
    setSelectedInitiative(null);
  };

  const handleSelectProgram = (program: Program) => {
    console.log('Program selected:', program);
    setSelectedProgram(program);
    setSelectedObjective(null);
    setSelectedInitiative(null);
  };

  const handleSelectInitiative = (initiative: StrategicInitiative) => {
    console.log('Initiative selected:', initiative);
    setSelectedInitiative(initiative);
  };

  // Initiative CRUD handlers
  const handleEditInitiative = (initiative: StrategicInitiative | {}) => {
    setEditingInitiative(initiative as StrategicInitiative);
    setShowInitiativeForm(true);
  };

  const handleSaveInitiative = async (data: any) => {
    try {
      setError(null);
      
      if (editingInitiative?.id) {
        await initiatives.update(editingInitiative.id, data);
      } else {
        await initiatives.create(data);
      }
      
      // Refresh initiatives data
      queryClient.invalidateQueries({ queryKey: ['initiatives'] });
      setRefreshKey(prev => prev + 1);
      
      setShowInitiativeForm(false);
      setEditingInitiative(null);
      setSuccess('Initiative saved successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (error: any) {
      console.error('Failed to save initiative:', error);
      setError(error.message || 'Failed to save initiative');
    }
  };

  // Performance measure CRUD handlers
  const handleEditMeasure = (measure: PerformanceMeasure | {}) => {
    setEditingMeasure(measure as PerformanceMeasure);
    setShowMeasureForm(true);
  };

  const handleSaveMeasure = async (data: any) => {
    try {
      setError(null);
      
      if (editingMeasure?.id) {
        await performanceMeasures.update(editingMeasure.id, data);
      } else {
        await performanceMeasures.create(data);
      }
      
      // Refresh measures data
      queryClient.invalidateQueries({ queryKey: ['performance-measures'] });
      setRefreshKey(prev => prev + 1);
      
      setShowMeasureForm(false);
      setEditingMeasure(null);
      setSuccess('Performance measure saved successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (error: any) {
      console.error('Failed to save performance measure:', error);
      setError(error.message || 'Failed to save performance measure');
    }
  };

  // Main activity CRUD handlers
  const handleEditActivity = (activity: MainActivity | {}) => {
    setEditingActivity(activity as MainActivity);
    setShowActivityForm(true);
  };

  const handleSaveActivity = async (data: any) => {
    try {
      setError(null);
      
      if (editingActivity?.id) {
        await mainActivities.update(editingActivity.id, data);
      } else {
        await mainActivities.create(data);
      }
      
      // Refresh activities data
      queryClient.invalidateQueries({ queryKey: ['main-activities'] });
      setRefreshKey(prev => prev + 1);
      
      setShowActivityForm(false);
      setEditingActivity(null);
      setSuccess('Main activity saved successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (error: any) {
      console.error('Failed to save main activity:', error);
      setError(error.message || 'Failed to save main activity');
    }
  };

  // Budget handlers
  const handleAddBudget = (activity: MainActivity, calculationType: BudgetCalculationType, activityType?: ActivityType) => {
    setSelectedActivity(activity);
    setBudgetCalculationType(calculationType);
    setSelectedActivityType(activityType || null);
    
    if (calculationType === 'WITH_TOOL' && activityType) {
      setShowCostingTool(true);
    } else {
      setShowBudgetForm(true);
    }
  };

  const handleEditBudget = (activity: MainActivity) => {
    setSelectedActivity(activity);
    setEditingBudget(activity.budget || null);
    
    if (activity.budget?.budget_calculation_type === 'WITH_TOOL') {
      setBudgetCalculationType('WITH_TOOL');
      setSelectedActivityType(activity.budget.activity_type || null);
    } else {
      setBudgetCalculationType('WITHOUT_TOOL');
      setSelectedActivityType(null);
    }
    
    setShowBudgetForm(true);
  };

  const handleViewBudget = (activity: MainActivity) => {
    setSelectedActivity(activity);
    setShowBudgetDetails(true);
  };

  const handleCostingToolComplete = (costingData: any) => {
    console.log('Costing tool completed with data:', costingData);
    setCostingToolData(costingData);
    setShowCostingTool(false);
    setShowBudgetForm(true);
  };

  const handleSaveBudget = async (budgetData: any) => {
    try {
      setError(null);
      
      if (!selectedActivity?.id) {
        throw new Error('No activity selected for budget');
      }
      
      console.log('Saving budget for activity:', selectedActivity.id);
      console.log('Budget data:', budgetData);
      
      // Use the custom budget update endpoint
      const response = await mainActivities.updateBudget(selectedActivity.id, budgetData);
      
      console.log('Budget saved successfully:', response.data);
      
      // Refresh activities data to get updated budget
      queryClient.invalidateQueries({ queryKey: ['main-activities'] });
      setRefreshKey(prev => prev + 1);
      
      setShowBudgetForm(false);
      setSelectedActivity(null);
      setEditingBudget(null);
      setCostingToolData(null);
      setSuccess('Budget saved successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (error: any) {
      console.error('Failed to save budget:', error);
      setError(error.message || 'Failed to save budget');
    }
  };

  // Plan submission handlers
  const handleReviewPlan = () => {
    setCurrentStep('review');
  };

  const handleSubmitPlan = async () => {
    try {
      setIsSubmitting(true);
      setError(null);
      
      if (!userOrganization || selectedObjectives.length === 0) {
        throw new Error('Missing required plan data');
      }
      
      // Create plan data
      const planData = {
        organization: userOrganization.id,
        planner_name: plannerName,
        type: selectedPlanType,
        strategic_objective: selectedObjectives[0].id, // Primary objective
        fiscal_year: new Date().getFullYear().toString(),
        from_date: fromDate,
        to_date: toDate,
        status: 'SUBMITTED'
      };
      
      console.log('Submitting plan:', planData);
      
      // Create the plan
      const createdPlan = await plans.create(planData);
      console.log('Plan created:', createdPlan);
      
      setSuccess('Plan submitted successfully!');
      
      // Navigate to dashboard after short delay
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
      
    } catch (error: any) {
      console.error('Failed to submit plan:', error);
      setError(error.message || 'Failed to submit plan');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Navigation handlers
  const handleBack = () => {
    switch (currentStep) {
      case 'objective-selection':
        setCurrentStep('plan-type');
        break;
      case 'planning':
        setCurrentStep('objective-selection');
        break;
      case 'review':
        setCurrentStep('planning');
        break;
      case 'submit':
        setCurrentStep('review');
        break;
      default:
        navigate('/dashboard');
    }
  };

  const handleCancel = () => {
    setShowInitiativeForm(false);
    setShowMeasureForm(false);
    setShowActivityForm(false);
    setShowBudgetForm(false);
    setShowBudgetDetails(false);
    setShowCostingTool(false);
    setEditingInitiative(null);
    setEditingMeasure(null);
    setEditingActivity(null);
    setEditingBudget(null);
    setSelectedActivity(null);
    setCostingToolData(null);
    setError(null);
  };

  // Render costing tools
  const renderCostingTool = () => {
    if (!selectedActivityType || !selectedActivity) return null;

    const commonProps = {
      onCalculate: handleCostingToolComplete,
      onCancel: handleCancel,
      initialData: costingToolData
    };

    switch (selectedActivityType) {
      case 'Training':
        return <TrainingCostingTool {...commonProps} />;
      case 'Meeting':
      case 'Workshop':
        return <MeetingWorkshopCostingTool {...commonProps} />;
      case 'Supervision':
        return <SupervisionCostingTool {...commonProps} />;
      case 'Printing':
        return <PrintingCostingTool {...commonProps} />;
      case 'Procurement':
        return <ProcurementCostingTool {...commonProps} />;
      default:
        return null;
    }
  };

  // Main render
  return (
    <div className="px-4 py-6 sm:px-0">
      {/* Error and Success Messages */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center text-red-700">
          <AlertCircle className="h-5 w-5 mr-2" />
          {error}
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center text-green-700">
          <CheckCircle className="h-5 w-5 mr-2" />
          {success}
        </div>
      )}

      {/* Step Navigation */}
      <div className="mb-8">
        <nav aria-label="Progress">
          <ol className="flex items-center">
            {[
              { key: 'plan-type', label: 'Plan Type' },
              { key: 'objective-selection', label: 'Objectives' },
              { key: 'planning', label: 'Planning' },
              { key: 'review', label: 'Review' }
            ].map((step, index) => (
              <li key={step.key} className={`${index !== 4 ? 'pr-8 sm:pr-20' : ''} relative`}>
                <div className="flex items-center">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${
                    currentStep === step.key 
                      ? 'border-green-600 bg-green-600 text-white' 
                      : ['plan-type', 'objective-selection'].includes(step.key) && 
                        ['objective-selection', 'planning', 'review'].includes(currentStep)
                        ? 'border-green-600 bg-green-600 text-white'
                        : 'border-gray-300 bg-white text-gray-500'
                  }`}>
                    <span className="text-sm font-medium">{index + 1}</span>
                  </div>
                  <span className={`ml-4 text-sm font-medium ${
                    currentStep === step.key ? 'text-green-600' : 'text-gray-500'
                  }`}>
                    {step.label}
                  </span>
                </div>
                {index !== 4 && (
                  <div className="absolute top-4 left-4 -ml-px mt-0.5 h-full w-0.5 bg-gray-300" aria-hidden="true" />
                )}
              </li>
            ))}
          </ol>
        </nav>
      </div>

      {/* Step Content */}
      <div className="space-y-8">
        {/* Step 1: Plan Type Selection */}
        {currentStep === 'plan-type' && (
          <PlanTypeSelector onSelectPlanType={handlePlanTypeSelect} />
        )}


        {/* Step 2: Objective Selection */}
        {currentStep === 'objective-selection' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <button
                onClick={handleBack}
                className="flex items-center text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-5 w-5 mr-1" />
                Back
              </button>
              <h2 className="text-xl font-semibold text-gray-900">
                Select Strategic Objectives
              </h2>
              <div></div>
            </div>

            <HorizontalObjectiveSelector
              onObjectivesSelected={handleObjectivesSelected}
              onProceed={handleProceedToPlanning}
              initialObjectives={selectedObjectives}
            />
          </div>
        )}

        {/* Step 3: Planning Interface */}
        {currentStep === 'planning' && (
          <div className="space-y-6">
            {/* Planning Header */}
            <PlanningHeader
              organizationName={userOrganization?.name || 'Unknown Organization'}
              fromDate={fromDate}
              toDate={toDate}
              plannerName={plannerName}
              planType={selectedPlanType}
              onFromDateChange={setFromDate}
              onToDateChange={setToDate}
              onPlanTypeChange={setSelectedPlanType}
            />

            {/* Navigation and Actions */}
            <div className="flex items-center justify-between">
              <button
                onClick={handleBack}
                className="flex items-center text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-5 w-5 mr-1" />
                Back to Objectives
              </button>
              
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowPreviewModal(true)}
                  className="flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Preview Plan
                </button>
                <button
                  onClick={handleReviewPlan}
                  className="flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Review & Submit
                </button>
              </div>
            </div>

            {/* 3-Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Column 1: Selected Objectives */}
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                  <Target className="h-5 w-5 mr-2 text-blue-600" />
                  Selected Objectives
                </h3>
                <StrategicObjectivesList
                  onSelectObjective={handleSelectObjective}
                  selectedObjectiveId={selectedObjective?.id}
                  onSelectProgram={handleSelectProgram}
                  selectedObjectives={selectedObjectives}
                />
              </div>

              {/* Column 2: Initiatives */}
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                  <BarChart3 className="h-5 w-5 mr-2 text-green-600" />
                  Strategic Initiatives
                </h3>
                {(selectedObjective || selectedProgram) ? (
                  <InitiativeList
                    parentId={(selectedObjective?.id || selectedProgram?.id)?.toString() || ''}
                    parentType={selectedObjective ? 'objective' : 'program'}
                    parentWeight={selectedObjective ? (selectedObjective.effective_weight || selectedObjective.planner_weight || selectedObjective.weight) : (selectedProgram?.strategic_objective?.weight || 100)}
                    onEditInitiative={handleEditInitiative}
                    onSelectInitiative={handleSelectInitiative}
                    planKey={`planning-${refreshKey}`}
                    isUserPlanner={isUserPlanner}
                    userOrgId={userOrgId}
                  />
                ) : (
                  <div className="text-center p-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                    <BarChart3 className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500">Select an objective to view initiatives</p>
                  </div>
                )}
              </div>

              {/* Column 3: Performance Measures & Main Activities */}
              <div className="space-y-6">
                {/* Performance Measures */}
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                    <Activity className="h-5 w-5 mr-2 text-purple-600" />
                    Performance Measures
                  </h3>
                  {selectedInitiative ? (
                    <PerformanceMeasureList
                      initiativeId={selectedInitiative.id}
                      initiativeWeight={Number(selectedInitiative.weight)}
                      onEditMeasure={handleEditMeasure}
                      onSelectMeasure={() => {}}
                      planKey={`planning-${refreshKey}`}
                    />
                  ) : (
                    <div className="text-center p-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                      <Activity className="h-6 w-6 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-500 text-sm">Select an initiative to view performance measures</p>
                    </div>
                  )}
                </div>

                {/* Main Activities */}
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                    <DollarSign className="h-5 w-5 mr-2 text-orange-600" />
                    Main Activities
                  </h3>
                  {selectedInitiative ? (
                    <MainActivityList
                      initiativeId={selectedInitiative.id}
                      initiativeWeight={Number(selectedInitiative.weight)}
                      onEditActivity={handleEditActivity}
                      onSelectActivity={() => {}}
                      onAddBudget={handleAddBudget}
                      onEditBudget={handleEditBudget}
                      onViewBudget={handleViewBudget}
                      planKey={`planning-${refreshKey}`}
                      isUserPlanner={isUserPlanner}
                      userOrgId={userOrgId}
                    />
                  ) : (
                    <div className="text-center p-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                      <DollarSign className="h-6 w-6 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-500 text-sm">Select an initiative to view main activities</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Review */}
        {currentStep === 'review' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <button
                onClick={handleBack}
                className="flex items-center text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-5 w-5 mr-1" />
                Back to Planning
              </button>
              <h2 className="text-xl font-semibold text-gray-900">Review Your Plan</h2>
              <div></div>
            </div>

            <PlanReviewTable
              objectives={selectedObjectives}
              onSubmit={handleSubmitPlan}
              isSubmitting={isSubmitting}
              organizationName={userOrganization?.name || 'Unknown Organization'}
              plannerName={plannerName}
              fromDate={fromDate}
              toDate={toDate}
              planType={selectedPlanType}
              userOrgId={userOrgId}
            />
          </div>
        )}
      </div>

      {/* Modals and Forms */}
      
      {/* Initiative Form Modal */}
      {showInitiativeForm && (selectedObjective || selectedProgram) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {editingInitiative?.id ? 'Edit Initiative' : 'Create Initiative'}
            </h3>
            
            <InitiativeForm
              parentId={(selectedObjective?.id || selectedProgram?.id)?.toString() || ''}
              parentType={selectedObjective ? 'objective' : 'program'}
              parentWeight={selectedObjective?.weight || selectedProgram?.strategic_objective?.weight || 100}
              currentTotal={0}
              onSubmit={handleSaveInitiative}
              onCancel={handleCancel}
              initialData={editingInitiative}
            />
          </div>
        </div>
      )}

      {/* Performance Measure Form Modal */}
      {showMeasureForm && selectedInitiative && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {editingMeasure?.id ? 'Edit Performance Measure' : 'Create Performance Measure'}
            </h3>
            
            <PerformanceMeasureForm
              initiativeId={selectedInitiative.id}
              currentTotal={0}
              onSubmit={handleSaveMeasure}
              onCancel={handleCancel}
              initialData={editingMeasure}
            />
          </div>
        </div>
      )}

      {/* Main Activity Form Modal */}
      {showActivityForm && selectedInitiative && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {editingActivity?.id ? 'Edit Main Activity' : 'Create Main Activity'}
            </h3>
            
            <MainActivityForm
              initiativeId={selectedInitiative.id}
              currentTotal={0}
              onSubmit={handleSaveActivity}
              onCancel={handleCancel}
              initialData={editingActivity}
            />
          </div>
        </div>
      )}

      {/* Costing Tool Modal */}
      {showCostingTool && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {selectedActivityType} Cost Calculator
              </h3>
              {renderCostingTool()}
            </div>
          </div>
        </div>
      )}

      {/* Budget Form Modal */}
      {showBudgetForm && selectedActivity && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {editingBudget ? 'Edit Budget' : 'Add Budget'} - {selectedActivity.name}
            </h3>
            
            <ActivityBudgetForm
              activity={selectedActivity}
              budgetCalculationType={budgetCalculationType}
              activityType={selectedActivityType}
              onSubmit={handleSaveBudget}
              onCancel={handleCancel}
              initialData={editingBudget || costingToolData}
              isSubmitting={isSubmitting}
            />
          </div>
        </div>
      )}

      {/* Budget Details Modal */}
      {showBudgetDetails && selectedActivity && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <ActivityBudgetDetails
              activity={selectedActivity}
              onBack={handleCancel}
              onEdit={() => {
                setShowBudgetDetails(false);
                handleEditBudget(selectedActivity);
              }}
              isReadOnly={!isUserPlanner}
            />
          </div>
        </div>
      )}

      {/* Plan Preview Modal */}
      <PlanPreviewModal
        isOpen={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        objectives={selectedObjectives}
        organizationName={userOrganization?.name || 'Unknown Organization'}
        plannerName={plannerName}
        fromDate={fromDate}
        toDate={toDate}
        planType={selectedPlanType}
        refreshKey={refreshKey}
      />
    </div>
  );
};

export default Planning;