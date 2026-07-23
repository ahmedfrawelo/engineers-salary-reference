import type { Meta, StoryObj } from '@storybook/angular';

import { SkeletonComponent } from './skeleton.component';

const meta: Meta<SkeletonComponent> = {
  title: 'Shared/Skeleton',
  component: SkeletonComponent,
  args: {
    type: 'text',
    width: '240px',
    height: '16px'
  },
  argTypes: {
    type: {
      control: { type: 'select' },
      options: ['text', 'circle', 'rect']
    }
  }
};

export default meta;

type Story = StoryObj<SkeletonComponent>;

export const Text: Story = {
  args: {
    type: 'text',
    width: '280px',
    height: '16px'
  }
};

export const Circle: Story = {
  args: {
    type: 'circle',
    width: '64px',
    height: '64px'
  }
};

export const Rectangle: Story = {
  args: {
    type: 'rect',
    width: '280px',
    height: '72px'
  }
};
