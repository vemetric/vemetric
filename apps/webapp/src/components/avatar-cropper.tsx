import { Box, Button, Flex, Slider, Text } from '@chakra-ui/react';
import { useCallback, useState } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import {
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from '@/components/ui/dialog';

interface AvatarCropperProps {
  image: string;
  open: boolean;
  onClose: () => void;
  onCropComplete: (croppedBlob: Blob) => void;
  isLoading?: boolean;
}

export function AvatarCropper({ image, open, onClose, onCropComplete, isLoading }: AvatarCropperProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const onCropChange = useCallback((location: { x: number; y: number }) => {
    setCrop(location);
  }, []);

  const onZoomChange = useCallback((value: number) => {
    setZoom(value);
  }, []);

  const onCropAreaChange = useCallback((_: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return;
    const croppedBlob = await getCroppedImage(image, croppedAreaPixels);
    onCropComplete(croppedBlob);
  };

  return (
    <DialogRoot
      open={open}
      onOpenChange={({ open }) => {
        if (!open) onClose();
      }}
    >
      <DialogContent maxW="500px">
        <DialogHeader>
          <DialogTitle>Crop Avatar</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <Box position="relative" h="300px" bg="black" borderRadius="md" overflow="hidden">
            <Cropper
              image={image}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              onCropChange={onCropChange}
              onZoomChange={onZoomChange}
              onCropComplete={onCropAreaChange}
            />
          </Box>
          <Flex align="center" gap={4} mt={4}>
            <Text fontSize="sm" color="fg.muted" flexShrink={0}>
              Zoom
            </Text>
            <Slider.Root
              value={[zoom]}
              onValueChange={({ value }) => onZoomChange(value[0])}
              min={1}
              max={3}
              step={0.1}
              flex={1}
            >
              <Slider.Control>
                <Slider.Track>
                  <Slider.Range />
                </Slider.Track>
                <Slider.Thumb index={0} />
              </Slider.Control>
            </Slider.Root>
          </Flex>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button colorPalette="blue" onClick={handleConfirm} loading={isLoading}>
            Save
          </Button>
        </DialogFooter>
        <DialogCloseTrigger />
      </DialogContent>
    </DialogRoot>
  );
}

// Helper function to crop the image using Canvas
async function getCroppedImage(imageSrc: string, pixelCrop: Area): Promise<Blob> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  // Output size (500x500 max)
  const size = Math.min(pixelCrop.width, 500);
  canvas.width = size;
  canvas.height = size;

  ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, size, size);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), 'image/webp', 0.85);
  });
}

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', reject);
    image.src = url;
  });
}
