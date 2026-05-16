/**
 * FormsPage — host wrapper that mounts the Shuffle-Core <FormInput /> at
 * `/forms` and `/forms/:id`. Bridges AuthContext into the props the original
 * RunWorkflow component expects (`isLoaded`, `isLoggedIn`, `userdata`,
 * `globalUrl`).
 */
import FormInput from '@/Shuffle-Core/FormInput';
import { useAuth } from '@/context/AuthContext';
import { API_CONFIG } from '@/Shuffle-MCPs/api';

const FormsPage = () => {
  const { isAuthenticated, isLoading, userInfo } = useAuth();
  return (
    <FormInput
      globalUrl={API_CONFIG.baseUrl}
      isLoaded={!isLoading}
      isLoggedIn={isAuthenticated}
      setIsLoggedIn={() => {}}
      setCookie={() => {}}
      register={false}
      serverside={false}
      userdata={userInfo ? {
        id: userInfo.id,
        username: userInfo.username,
        support: userInfo.support,
        active_org: userInfo.active_org,
        orgs: userInfo.orgs,
      } as any : { active_org: {} } as any}
    />
  );
};

export default FormsPage;
