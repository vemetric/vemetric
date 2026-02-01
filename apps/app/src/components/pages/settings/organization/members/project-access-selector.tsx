import { Box, Button, Flex, Listbox, Switch, Text, createListCollection } from '@chakra-ui/react';
import { useMemo } from 'react';
import { TbCheckbox, TbShieldCheck, TbShieldLock, TbSquare } from 'react-icons/tb';
import { LoadingImage } from '@/components/loading-image';
import { Tooltip } from '@/components/ui/tooltip';
import { getFaviconUrl } from '@/utils/favicon';

interface Project {
  id: string;
  name: string;
  domain: string;
}

interface Props {
  projects: Project[];
  selectedProjectIds: string[];
  onSelectionChange: (projectIds: string[]) => void;
  hasRestrictions: boolean;
  onRestrictionsChange: (enabled: boolean) => void;
  disabled?: boolean;
  /** Text shown when restrictions are disabled */
  fullAccessText?: string;
  /** Tooltip text for the restrict toggle */
  restrictTooltip?: string;
}

export const ProjectAccessSelector = (props: Props) => {
  const {
    projects,
    selectedProjectIds,
    onSelectionChange,
    hasRestrictions,
    onRestrictionsChange,
    disabled = false,
    fullAccessText = 'Full access to all projects in the organization.',
    restrictTooltip = 'When enabled, access is limited to the selected projects only.',
  } = props;

  const collection = useMemo(
    () =>
      createListCollection({
        items: projects.map((p) => ({
          label: p.name,
          value: p.id,
          domain: p.domain,
        })),
      }),
    [projects],
  );

  const handleValueChange = (details: { value: string[] }) => {
    if (disabled) return;
    onSelectionChange(details.value);
  };

  const selectAll = () => {
    if (!disabled) {
      onSelectionChange(projects.map((p) => p.id));
    }
  };

  const selectNone = () => {
    if (!disabled) {
      onSelectionChange([]);
    }
  };

  const toggleRestrictions = (enabled: boolean) => {
    if (disabled) return;
    onRestrictionsChange(enabled);
  };

  const allSelected = projects.length > 0 && selectedProjectIds.length === projects.length;
  const noneSelected = selectedProjectIds.length === 0;

  return (
    <Box>
      <Flex justify="space-between" align="center" mb={3}>
        <Flex align="center" gap={2}>
          <Box color="purple.fg">{!hasRestrictions ? <TbShieldCheck size={18} /> : <TbShieldLock size={18} />}</Box>
          <Text fontSize="sm" fontWeight="medium">
            Project Access
          </Text>
        </Flex>

        {!disabled && (
          <Tooltip content={restrictTooltip} closeOnClick={false}>
            <Box>
              <Switch.Root
                colorPalette="purple"
                size="sm"
                checked={hasRestrictions}
                onCheckedChange={(e) => toggleRestrictions(e.checked)}
              >
                <Switch.HiddenInput />
                <Switch.Label fontSize="sm" color="fg.muted">
                  Restrict access
                </Switch.Label>
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch.Root>
            </Box>
          </Tooltip>
        )}
      </Flex>

      {!hasRestrictions ? (
        <Text fontSize="sm" color="fg.muted">
          {fullAccessText}
        </Text>
      ) : (
        <Flex direction="column" gap={2}>
          {!disabled && (
            <Flex gap={2}>
              <Button size="xs" variant="surface" onClick={selectAll} disabled={allSelected}>
                <TbCheckbox /> Select all
              </Button>
              <Button size="xs" variant="surface" onClick={selectNone} disabled={noneSelected}>
                <TbSquare /> Select none
              </Button>
            </Flex>
          )}

          {projects.length === 0 ? (
            <Text fontSize="sm" color="fg.muted">
              No projects in this organization yet.
            </Text>
          ) : (
            <Listbox.Root
              collection={collection}
              selectionMode="multiple"
              value={selectedProjectIds}
              onValueChange={handleValueChange}
              disabled={disabled}
            >
              <Listbox.Content maxH="200px" borderWidth="1px" rounded="md">
                {collection.items.map((project) => (
                  <Listbox.Item item={project} key={project.value} rounded="md">
                    <Flex align="center" gap={3} flex="1">
                      <LoadingImage
                        src={getFaviconUrl(project.domain)}
                        alt={project.label}
                        boxSize="24px"
                        rounded="md"
                        overflow="hidden"
                      />
                      <Box>
                        <Listbox.ItemText fontSize="sm" fontWeight="medium">
                          {project.label}
                        </Listbox.ItemText>
                        <Text fontSize="xs" color="fg.muted">
                          {project.domain}
                        </Text>
                      </Box>
                    </Flex>
                    <Listbox.ItemIndicator color="purple.fg" />
                  </Listbox.Item>
                ))}
              </Listbox.Content>
            </Listbox.Root>
          )}
        </Flex>
      )}
    </Box>
  );
};
