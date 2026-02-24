import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface IInterface {
  company: null;
}

const initialState: IInterface = {
  company: null,
};

export const userInfo = createSlice({
  name: 'filter-params',
  initialState,
  reducers: {
    setCompany: (state, action: PayloadAction<null>) => {
      state.company = action.payload;
    },
  },
});

// Export actions and reducer
export const { setCompany } = userInfo.actions;
export default userInfo.reducer;
