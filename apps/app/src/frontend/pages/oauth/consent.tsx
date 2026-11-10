import {
  Box,
  Button,
  Card,
  Checkbox,
  Container,
  Flex,
  Heading,
  Image,
  Link,
  Spinner,
  Stack,
  Switch,
  Text,
} from '@chakra-ui/react';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { TbArrowBackUp, TbEye, TbPlugConnected, TbWorld } from 'react-icons/tb';
import { Logo } from '@/components/logo';
import { ProjectAccessSelector } from '@/components/pages/settings/organization/members/project-access-selector';
import { ErrorState } from '@/components/ui/empty-state';
import { toaster } from '@/components/ui/toaster';
import { UserIdentity } from '@/components/user-identity';
import { authClient } from '@/utils/auth';
import { requireAuthentication } from '@/utils/auth-guards';
import { clearPendingOauthAuthorize, getSignedOauthQuery } from '@/utils/oauth-flow';
import { trpc, type OauthConsentInfo } from '@/utils/trpc';
import { getLandingPageUrl } from '@/utils/url';

export const Route = createFileRoute('/oauth/consent')({
  beforeLoad: () => requireAuthentication(),
  component: ConsentPage,
});

type ConsentInfo = OauthConsentInfo;
type Organization = ConsentInfo['organizations'][number];

/** Per organization: shared at all, and if so all its projects (also future ones) or only the chosen ones. */
type OrganizationChoice = { shared: boolean; restricted: boolean; projectIds: string[] };

function getInitialChoices(info: ConsentInfo) {
  const access = info.currentAccess;
  const choices: Record<string, OrganizationChoice> = {};
  for (const organization of info.organizations) {
    const chosenProjectIds = organization.projects.map(({ id }) => id).filter((id) => access?.projectIds.includes(id));
    const sharedFully = !access || access.allOrganizations || access.organizationIds.includes(organization.id);
    choices[organization.id] = {
      shared: sharedFully || chosenProjectIds.length > 0,
      restricted: !sharedFully && chosenProjectIds.length > 0,
      projectIds: sharedFully ? [] : chosenProjectIds,
    };
  }
  // Users with several organizations share all of them by default, like "All repositories" on GitHub.
  const allOrganizations = info.organizations.length > 1 && (!access || access.allOrganizations);
  return { allOrganizations, choices };
}

async function sendConsent(accept: boolean, oauthQuery: string) {
  const { data, error } = await authClient.$fetch<{ redirect?: boolean; url?: string }>('/oauth2/consent', {
    method: 'POST',
    body: { accept, oauth_query: oauthQuery },
  });
  if (error || !data?.url) {
    throw new Error(error?.message || 'The authorization failed. Please connect again from your app.');
  }
  window.location.href = data.url;
}

function ConsentPage() {
  const oauthQuery = useMemo(() => getSignedOauthQuery(), []);
  const { data: session } = authClient.useSession();
  const {
    data: info,
    error,
    isLoading,
  } = trpc.oauth.consentInfo.useQuery(
    { oauthQuery: oauthQuery ?? '' },
    { enabled: !!oauthQuery, retry: false, refetchOnWindowFocus: false },
  );

  useEffect(() => {
    // The flow arrived here, so there's nothing to resume after a login anymore.
    clearPendingOauthAuthorize();
  }, []);

  if (!oauthQuery || error) {
    return (
      <PageFrame>
        <ErrorState
          title="This connection request is invalid or has expired"
          description={error?.message ?? 'Please connect again from your app.'}
        />
      </PageFrame>
    );
  }

  if (isLoading || !info) {
    return (
      <Flex minH="100dvh" align="center" justify="center">
        <Spinner size="lg" />
      </Flex>
    );
  }

  return (
    <PageFrame>
      <ConsentForm info={info} oauthQuery={oauthQuery} />
      {session?.user && (
        <Flex align="center" gap={2} justify="center" flexWrap="wrap" mt={5} color="fg.muted">
          <Text fontSize="sm" flexShrink="0">
            Signed in as
          </Text>
          <UserIdentity
            displayName={session.user.name || session.user.email || 'Unnamed'}
            image={session.user.image}
            avatarSize="2xs"
          />
        </Flex>
      )}
    </PageFrame>
  );
}

function PageFrame({ children }: { children: React.ReactNode }) {
  return (
    <Flex minH="100dvh" align="center" justify="center" p={4}>
      <Container maxW="lg" px={0}>
        <Stack gap={6} align="center">
          <Link href={getLandingPageUrl()}>
            <Logo asLink={false} h="50px" />
          </Link>
          <Card.Root w="full">
            <Card.Body>{children}</Card.Body>
          </Card.Root>
        </Stack>
      </Container>
    </Flex>
  );
}

function ConsentForm({ info, oauthQuery }: { info: ConsentInfo; oauthQuery: string }) {
  const initial = useMemo(() => getInitialChoices(info), [info]);
  const [allOrganizations, setAllOrganizations] = useState(initial.allOrganizations);
  const [choices, setChoices] = useState(initial.choices);
  const [pendingAction, setPendingAction] = useState<'allow' | 'deny' | null>(null);
  const { client, organizations } = info;

  const { mutateAsync: saveAccess } = trpc.oauth.saveAccess.useMutation();

  const access = {
    allOrganizations,
    organizationIds: allOrganizations
      ? []
      : organizations.filter(({ id }) => choices[id]?.shared && !choices[id].restricted).map(({ id }) => id),
    projectIds: allOrganizations
      ? []
      : organizations.flatMap(({ id }) =>
          choices[id]?.shared && choices[id].restricted ? choices[id].projectIds : [],
        ),
  };
  const sharesNothing =
    !access.allOrganizations && access.organizationIds.length === 0 && access.projectIds.length === 0;

  const updateChoice = (organizationId: string, update: Partial<OrganizationChoice>) =>
    setChoices((current) => ({ ...current, [organizationId]: { ...current[organizationId], ...update } }));

  const onAllow = async () => {
    setPendingAction('allow');
    try {
      await saveAccess({ oauthQuery, access });
      await sendConsent(true, oauthQuery);
    } catch (err) {
      setPendingAction(null);
      toaster.create({ title: 'Error', description: (err as Error).message, type: 'error' });
    }
  };

  const onDeny = async () => {
    setPendingAction('deny');
    try {
      await sendConsent(false, oauthQuery);
    } catch (err) {
      setPendingAction(null);
      toaster.create({ title: 'Error', description: (err as Error).message, type: 'error' });
    }
  };

  return (
    <Stack gap={6} pt={2}>
      <Stack gap={4} align="center" textAlign="center">
        {client.icon ? (
          <Image src={client.icon} alt="" boxSize="56px" rounded="lg" />
        ) : (
          <Box p={4} bg="purple.subtle" color="purple.fg" borderRadius="full">
            <TbPlugConnected size={28} />
          </Box>
        )}
        <Stack gap={2}>
          <Heading size="lg">Connect {client.name} to Vemetric</Heading>
          <Text color="fg.muted">
            <strong>{client.name}</strong> wants to access your analytics data.
          </Text>
        </Stack>
      </Stack>

      <Stack gap={2} fontSize="sm" color="fg.muted" borderWidth="1px" rounded="md" p={3}>
        <Flex gap={2} align="center">
          <TbEye />
          <Text>Read-only: it can query your analytics, but not change anything.</Text>
        </Flex>
        {client.redirectTo && (
          <Flex gap={2} align="center">
            <TbArrowBackUp />
            <Text>
              After allowing it, you&apos;ll return to <strong>{client.redirectTo}</strong>.
            </Text>
          </Flex>
        )}
        {(client.metadataHost || client.uri) && (
          <Flex gap={2} align="center">
            <TbWorld />
            <Text>
              {client.metadataHost ? (
                <>
                  Registered by <strong>{client.metadataHost}</strong>
                </>
              ) : (
                <Link href={client.uri ?? undefined} target="_blank" rel="noopener noreferrer" variant="underline">
                  {client.uri}
                </Link>
              )}
            </Text>
          </Flex>
        )}
      </Stack>

      <AccessChoice
        organizations={organizations}
        allOrganizations={allOrganizations}
        onAllOrganizationsChange={setAllOrganizations}
        choices={choices}
        onChoiceChange={updateChoice}
        disabled={pendingAction !== null}
      />

      <Stack gap={3}>
        <Text fontSize="xs" color="fg.muted" textAlign="center">
          Only allow apps you trust. You can change or remove the access anytime in your account settings under
          Connected apps.
        </Text>
        <Flex gap={3}>
          <Button
            flex="1"
            variant="outline"
            onClick={onDeny}
            loading={pendingAction === 'deny'}
            disabled={!!pendingAction}
          >
            Cancel
          </Button>
          <Button
            flex="1"
            colorPalette="purple"
            onClick={onAllow}
            loading={pendingAction === 'allow'}
            disabled={!!pendingAction || sharesNothing}
          >
            Allow access
          </Button>
        </Flex>
      </Stack>
    </Stack>
  );
}

interface AccessChoiceProps {
  organizations: Organization[];
  allOrganizations: boolean;
  onAllOrganizationsChange: (value: boolean) => void;
  choices: Record<string, OrganizationChoice>;
  onChoiceChange: (organizationId: string, update: Partial<OrganizationChoice>) => void;
  disabled: boolean;
}

function AccessChoice(props: AccessChoiceProps) {
  const { organizations, allOrganizations, onAllOrganizationsChange, choices, onChoiceChange, disabled } = props;

  if (organizations.length === 0) {
    return (
      <Text fontSize="sm" color="fg.muted" textAlign="center">
        You don&apos;t have any projects yet. Create a project in Vemetric first, then connect again.
      </Text>
    );
  }

  const renderProjects = (organization: Organization) => {
    const choice = choices[organization.id];
    return (
      <ProjectAccessSelector
        projects={organization.projects}
        selectedProjectIds={choice.projectIds}
        onSelectionChange={(projectIds) => onChoiceChange(organization.id, { projectIds })}
        hasRestrictions={choice.restricted}
        onRestrictionsChange={(restricted) => onChoiceChange(organization.id, { restricted, projectIds: [] })}
        disabled={disabled}
        fullAccessText="Access to all current and future projects of this organization."
        restrictTooltip="When enabled, only the selected projects are shared. Projects created later won't be added."
      />
    );
  };

  if (organizations.length === 1) {
    return renderProjects(organizations[0]);
  }

  return (
    <Stack gap={4}>
      <Flex justify="space-between" align="center" gap={3}>
        <Text fontSize="sm" fontWeight="medium">
          Share all organizations
        </Text>
        <Switch.Root
          colorPalette="purple"
          size="sm"
          checked={allOrganizations}
          onCheckedChange={(e) => onAllOrganizationsChange(e.checked)}
          disabled={disabled}
        >
          <Switch.HiddenInput />
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
        </Switch.Root>
      </Flex>
      {allOrganizations ? (
        <Text fontSize="sm" color="fg.muted">
          Access to all projects of all your organizations, also ones you create or join later.
        </Text>
      ) : (
        <Stack gap={3}>
          {organizations.map((organization) => {
            const choice = choices[organization.id];
            return (
              <Box key={organization.id} borderWidth="1px" rounded="md" p={3}>
                <Checkbox.Root
                  colorPalette="purple"
                  checked={choice.shared}
                  onCheckedChange={(e) => onChoiceChange(organization.id, { shared: !!e.checked })}
                  disabled={disabled}
                >
                  <Checkbox.HiddenInput />
                  <Checkbox.Control />
                  <Checkbox.Label fontWeight="medium">{organization.name}</Checkbox.Label>
                </Checkbox.Root>
                {choice.shared && <Box mt={3}>{renderProjects(organization)}</Box>}
              </Box>
            );
          })}
        </Stack>
      )}
    </Stack>
  );
}
