import { Box, Checkbox, Flex, Stack, Switch, Text } from '@chakra-ui/react';
import { useState } from 'react';
import { ProjectAccessSelector } from '@/components/pages/settings/organization/members/project-access-selector';

/** An organization the user can share with an app (e.g. Claude), with the projects they can access. */
export interface ShareableOrganization {
  id: string;
  name: string;
  projects: Array<{ id: string; name: string; domain: string }>;
}

/** What an app can access: all organizations, organizations with all their projects, or individual projects. */
export interface OauthAccess {
  allOrganizations: boolean;
  organizationIds: string[];
  projectIds: string[];
}

/** Per organization: shared at all, and if so all its projects (also future ones) or only the chosen ones. */
type OrganizationChoice = { shared: boolean; restricted: boolean; projectIds: string[] };

function getInitialChoices(organizations: ShareableOrganization[], access: OauthAccess | null) {
  const choices: Record<string, OrganizationChoice> = {};
  for (const organization of organizations) {
    const chosenProjectIds = organization.projects.map(({ id }) => id).filter((id) => access?.projectIds.includes(id));
    const sharedFully = !access || access.allOrganizations || access.organizationIds.includes(organization.id);
    choices[organization.id] = {
      shared: sharedFully || chosenProjectIds.length > 0,
      restricted: !sharedFully && chosenProjectIds.length > 0,
      projectIds: sharedFully ? [] : chosenProjectIds,
    };
  }
  // Users with several organizations share all of them by default, like "All repositories" on GitHub.
  const allOrganizations = organizations.length > 1 && (!access || access.allOrganizations);
  return { allOrganizations, choices };
}

/** The state of the access choice, starting from what the app can access today (or everything for a new app). */
export function useOauthAccessChoice(organizations: ShareableOrganization[], currentAccess: OauthAccess | null) {
  const [initial] = useState(() => getInitialChoices(organizations, currentAccess));
  const [allOrganizations, setAllOrganizations] = useState(initial.allOrganizations);
  const [choices, setChoices] = useState(initial.choices);

  const isShared = (id: string) => choices[id]?.shared && !allOrganizations;
  const access: OauthAccess = {
    allOrganizations,
    organizationIds: organizations.filter(({ id }) => isShared(id) && !choices[id].restricted).map(({ id }) => id),
    projectIds: organizations.flatMap(({ id }) =>
      isShared(id) && choices[id].restricted ? choices[id].projectIds : [],
    ),
  };
  const sharesNothing =
    !access.allOrganizations && access.organizationIds.length === 0 && access.projectIds.length === 0;

  const updateChoice = (organizationId: string, update: Partial<OrganizationChoice>) =>
    setChoices((current) => ({ ...current, [organizationId]: { ...current[organizationId], ...update } }));

  return { organizations, allOrganizations, setAllOrganizations, choices, updateChoice, access, sharesNothing };
}

type AccessChoiceState = ReturnType<typeof useOauthAccessChoice>;

/** Chooses what an app can access, on the consent page and in the connected apps settings. */
export function OauthAccessChoice({ state, disabled }: { state: AccessChoiceState; disabled?: boolean }) {
  const { organizations, allOrganizations, setAllOrganizations, choices, updateChoice } = state;

  if (organizations.length === 0) {
    return (
      <Text fontSize="sm" color="fg.muted" textAlign="center">
        You don&apos;t have any projects yet. Create a project in Vemetric first, then connect again.
      </Text>
    );
  }

  const renderProjects = (organization: ShareableOrganization) => {
    const choice = choices[organization.id];
    return (
      <ProjectAccessSelector
        projects={organization.projects}
        selectedProjectIds={choice.projectIds}
        onSelectionChange={(projectIds) => updateChoice(organization.id, { projectIds })}
        hasRestrictions={choice.restricted}
        onRestrictionsChange={(restricted) => updateChoice(organization.id, { restricted, projectIds: [] })}
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
          onCheckedChange={(e) => setAllOrganizations(e.checked)}
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
                  onCheckedChange={(e) => updateChoice(organization.id, { shared: !!e.checked })}
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

/** A short summary of what an app can access, e.g. "All organizations" or "Acme (all projects), 2 projects". */
export function describeOauthAccess(access: OauthAccess, organizations: ShareableOrganization[]): string {
  if (access.allOrganizations) {
    return 'All organizations and projects';
  }
  const organizationNames = organizations
    .filter(({ id }) => access.organizationIds.includes(id))
    .map(({ name }) => `${name} (all projects)`);
  const projectNames = organizations
    .flatMap(({ projects }) => projects)
    .filter(({ id }) => access.projectIds.includes(id))
    .map(({ name }) => name);
  return [...organizationNames, ...projectNames].join(', ') || 'No projects';
}
