import { IconButton, Badge, Table, Skeleton } from '@chakra-ui/react';
import { format } from 'date-fns';
import { TbDownload } from 'react-icons/tb';
import { toaster } from '~/components/ui/toaster';
import { trpc } from '~/utils/trpc';

function getColorPalette(status: string) {
  switch (status) {
    case 'completed':
    case 'paid':
      return 'green';
    case 'past_due':
    case 'canceled':
      return 'red';
    default:
      return 'gray';
  }
}

interface Props {
  organizationId: string;
}

export const BillingHistory = ({ organizationId }: Props) => {
  const { data: invoices, isLoading } = trpc.billing.billingHistory.useQuery({ organizationId });
  const { mutate: downloadInvoice } = trpc.billing.downloadInvoice.useMutation();

  return (
    <Table.Root size="sm" variant="outline" rounded="md">
      <Table.Header>
        <Table.Row>
          <Table.ColumnHeader>Invoice</Table.ColumnHeader>
          <Table.ColumnHeader>Status</Table.ColumnHeader>
          <Table.ColumnHeader>Date</Table.ColumnHeader>
          <Table.ColumnHeader />
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {isLoading ? (
          <Table.Row>
            <Table.Cell>
              <Skeleton height="20px" />
            </Table.Cell>
            <Table.Cell>
              <Skeleton height="20px" />
            </Table.Cell>
            <Table.Cell>
              <Skeleton height="20px" />
            </Table.Cell>
            <Table.Cell />
          </Table.Row>
        ) : (
          invoices?.map((item) => (
            <Table.Row key={item.id}>
              <Table.Cell>{item.id}</Table.Cell>
              <Table.Cell>
                <Badge colorPalette={getColorPalette(item.status)}>{item.status}</Badge>
              </Table.Cell>
              <Table.Cell>{format(item.createdAt, 'MMM d, yyyy')}</Table.Cell>
              <Table.Cell>
                {item.invoiceNumber && (
                  <IconButton
                    variant="ghost"
                    size="xs"
                    onClick={async () => {
                      await downloadInvoice(
                        {
                          organizationId,
                          transactionId: item.id,
                        },
                        {
                          onSuccess: (data) => {
                            window.open(data.url, '_blank');
                          },
                          onError: (error) => {
                            toaster.error({
                              title: 'Error downloading invoice',
                              description: error.message,
                            });
                          },
                        },
                      );
                    }}
                  >
                    <TbDownload />
                  </IconButton>
                )}
              </Table.Cell>
            </Table.Row>
          ))
        )}
      </Table.Body>
    </Table.Root>
  );
};
