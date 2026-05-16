/**
 * FormsPage — host wrapper that bridges AuthContext + API_CONFIG into the
 * standalone FormInput component from `@/Shuffle-Core`.
 *
 * Routes:
 *   /forms        -> list of forms (no id selected)
 *   /forms/:id    -> a specific form's run page
 *
 * Note: many of FormInput's features are powered by stubs in
 * `@/Shuffle-Core/FormInputStubs` because the original Shuffle Core
 * dependencies (EditWorkflow, RecentWorkflow, theme, etc.) are not yet
 * ported. See that file for the list of degraded features.
 */
import { useAuth } from '@/context/AuthContext';
import { API_CONFIG } from '@/Shuffle-MCPs/api';
import FormInput from '@/Shuffle-Core/FormInput';

const FormsPage = () => {
  const { user, isAuthenticated } = useAuth();
  return (
    <FormInput
      globalUrl={API_CONFIG.baseUrl}
      userdata={user || {}}
      isLoaded={true}
      isLoggedIn={!!isAuthenticated}
      setIsLoggedIn={() => {}}
      setCookie={() => {}}
      register={false}
      serverside={false}
    />
  );
};

export default FormsPage;
