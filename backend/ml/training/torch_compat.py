from __future__ import annotations

import numpy as np

try:  # pragma: no cover
    import torch  # type: ignore
    from torch import nn  # type: ignore
except Exception:  # pragma: no cover
    class _Module:
        def __call__(self, *args, **kwargs):
            return self.forward(*args, **kwargs)

        def forward(self, *args, **kwargs):
            raise NotImplementedError

    class _NN:
        Module = _Module

    class _Torch:
        Tensor = np.ndarray

    torch = _Torch()
    nn = _NN()
